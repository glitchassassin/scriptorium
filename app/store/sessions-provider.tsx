import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";

import { useSessionEvents } from "~/components/events/session-events-provider";
import {
  isSessionUnread,
  type SidebarSessionRecord,
} from "~/lib/projects/sidebar";
import type { OpencodeSessionStatus } from "~/lib/opencode/events";

type SessionsContextValue = Record<string, SidebarSessionRecord>;
type SessionStatusesContextValue = Record<string, OpencodeSessionStatus>;

type UnreadStatusEvent = {
  projectId: string;
  sessionId: string;
  updatedAt: number;
};

type UnreadStatusEventFilter = {
  projectId?: string;
  sessionId?: string;
};

type SessionsEventsContextValue = {
  subscribe: (handler: (event: UnreadStatusEvent) => void, filter?: UnreadStatusEventFilter) => () => void;
};

type SessionsActionsContextValue = {
  markReadOptimistic: (sessionId: string, lastReadAt?: number) => void;
};

type SessionsAction =
  | { type: "reset"; sessions: SessionsContextValue }
  | { type: "mark-read"; sessionId: string; lastReadAt: number }
  | { type: "question-asked"; sessionId: string; requestId: string }
  | { type: "question-resolved"; sessionId: string; requestId: string }
  | { type: "update"; sessionId: string; state: Partial<SidebarSessionRecord> | null };

type SessionStatusesAction =
  | { type: "reset"; statuses: SessionStatusesContextValue }
  | { type: "remove"; sessionId: string }
  | { type: "update"; sessionId: string; status: OpencodeSessionStatus };

const SessionsContext = createContext<SessionsContextValue | null>(null);
const SessionStatusesContext = createContext<SessionStatusesContextValue | null>(null);
const SessionsActionsContext = createContext<SessionsActionsContextValue | null>(null);
const SessionsEventsContext = createContext<SessionsEventsContextValue | null>(null);

const EMPTY_SESSION_STATUSES: SessionStatusesContextValue = {};
const IDLE_SESSION_STATUS = { type: "idle" } satisfies OpencodeSessionStatus;

export function getSessionStateId(sessionId: string) {
  return sessionId;
}

// Opencode can deliver activity-related events out of order, so sidebar timestamps
// must only move forward or a session can incorrectly flip back to read.
function mergeMonotonicTimestamp(previous: number | null, next: number | null | undefined) {
  if (next === undefined || next === null) {
    return previous;
  }

  if (previous === null) {
    return next;
  }

  return Math.max(previous, next);
}

function sessionsReducer(current: SessionsContextValue, action: SessionsAction) {
  switch (action.type) {
    case "reset":
      return action.sessions;
    case "mark-read": {
      const previous = current[action.sessionId];

      if (!previous || (previous.lastReadAt !== null && previous.lastReadAt >= action.lastReadAt)) {
        return current;
      }

      return {
        ...current,
        [action.sessionId]: {
          ...previous,
          lastReadAt: action.lastReadAt,
        },
      };
    }
    case "question-asked": {
      const previous = current[action.sessionId];

      if (!previous) {
        return current;
      }

      const pendingQuestionRequestIds = previous?.pendingQuestionRequestIds ?? [];

      if (pendingQuestionRequestIds.includes(action.requestId)) {
        return current;
      }

      return {
        ...current,
        [action.sessionId]: {
          ...previous,
          pendingQuestionRequestIds: [...pendingQuestionRequestIds, action.requestId],
        },
      };
    }
    case "question-resolved": {
      const previous = current[action.sessionId];

      if (!previous?.pendingQuestionRequestIds?.includes(action.requestId)) {
        return current;
      }

      return {
        ...current,
        [action.sessionId]: {
          ...previous,
          pendingQuestionRequestIds: previous.pendingQuestionRequestIds.filter((requestId) => requestId !== action.requestId),
        },
      };
    }
    case "update": {
      const previous = current[action.sessionId];
      const nextPartial = action.state;

      if (nextPartial === null) {
        if (!(action.sessionId in current)) {
          return current;
        }

        const { [action.sessionId]: _removed, ...rest } = current;
        return rest;
      }

      const nextUpdatedAt = mergeMonotonicTimestamp(previous?.updatedAt ?? null, nextPartial.updatedAt);
      const nextLastReadAt = mergeMonotonicTimestamp(previous?.lastReadAt ?? null, nextPartial.lastReadAt);

      const next = {
        id: action.sessionId,
        parentID: previous?.parentID ?? null,
        title: previous?.title ?? null,
        directory: previous?.directory ?? null,
        createdAt: previous?.createdAt ?? null,
        pendingQuestionRequestIds: previous?.pendingQuestionRequestIds ?? [],
        ...nextPartial,
        updatedAt: nextUpdatedAt,
        lastReadAt: nextLastReadAt,
      } satisfies SidebarSessionRecord;

      if (
        previous?.parentID === next.parentID
        &&
        previous?.title === next.title
        && previous?.directory === next.directory
        && previous?.createdAt === next.createdAt
        && previous?.updatedAt === next.updatedAt
        && previous?.lastReadAt === next.lastReadAt
        && previous?.pendingQuestionRequestIds?.join(",") === next.pendingQuestionRequestIds?.join(",")
      ) {
        return current;
      }

      return {
        ...current,
        [action.sessionId]: next,
      };
    }
  }
}

function areSessionStatusesEqual(left: OpencodeSessionStatus | undefined, right: OpencodeSessionStatus) {
  if (!left || left.type !== right.type) {
    return false;
  }

  if (left.type !== "retry" || right.type !== "retry") {
    return true;
  }

  return left.attempt === right.attempt && left.message === right.message && left.next === right.next;
}

function sessionStatusesReducer(current: SessionStatusesContextValue, action: SessionStatusesAction) {
  switch (action.type) {
    case "reset":
      if (Object.keys(current).length === 0) {
        return action.statuses;
      }

      return {
        ...action.statuses,
        ...current,
      };
    case "remove": {
      if (!(action.sessionId in current)) {
        return current;
      }

      const { [action.sessionId]: _removed, ...rest } = current;
      return rest;
    }
    case "update": {
      if (areSessionStatusesEqual(current[action.sessionId], action.status)) {
        return current;
      }

      return {
        ...current,
        [action.sessionId]: action.status,
      };
    }
  }
}

export function SessionsProvider({
  children,
  initialSessions,
  initialStatuses = EMPTY_SESSION_STATUSES,
}: {
  children: ReactNode;
  initialSessions: SessionsContextValue;
  initialStatuses?: SessionStatusesContextValue;
}) {
  const [sessions, dispatch] = useReducer(sessionsReducer, initialSessions);
  const [statuses, dispatchStatuses] = useReducer(sessionStatusesReducer, initialStatuses);
  const subscribersRef = useRef(new Map<number, { filter?: UnreadStatusEventFilter; handler: (event: UnreadStatusEvent) => void }>());
  const subscriberIdRef = useRef(0);

  useEffect(() => {
    dispatch({ type: "reset", sessions: initialSessions });
  }, [initialSessions]);

  useEffect(() => {
    dispatchStatuses({ type: "reset", statuses: initialStatuses });
  }, [initialStatuses]);

  const subscribe = useCallback<SessionsEventsContextValue["subscribe"]>((handler, filter) => {
    const subscriberId = subscriberIdRef.current;
    subscriberIdRef.current += 1;
    subscribersRef.current.set(subscriberId, { filter, handler });

    return () => {
      subscribersRef.current.delete(subscriberId);
    };
  }, []);

  const notifyUnreadStatusEvent = useCallback((event: UnreadStatusEvent) => {
    for (const subscriber of subscribersRef.current.values()) {
      if (subscriber.filter?.projectId && subscriber.filter.projectId !== event.projectId) {
        continue;
      }

      if (subscriber.filter?.sessionId && subscriber.filter.sessionId !== event.sessionId) {
        continue;
      }

      subscriber.handler(event);
    }
  }, []);

  const markReadOptimistic = useCallback<SessionsActionsContextValue["markReadOptimistic"]>((sessionId, lastReadAt = Date.now()) => {
    dispatch({
      type: "mark-read",
      sessionId: getSessionStateId(sessionId),
      lastReadAt,
    });
  }, []);

  const eventsValue = useMemo<SessionsEventsContextValue>(() => ({ subscribe }), [subscribe]);
  const actionsValue = useMemo<SessionsActionsContextValue>(() => ({ markReadOptimistic }), [markReadOptimistic]);

  useSessionEvents((event) => {
    switch (event.type) {
      case "session.read":
        dispatch({
          type: "update",
          sessionId: event.sessionId,
          state: { lastReadAt: event.lastReadAt },
        });
        return;
      case "session.summary": {
        const updatedAt = event.summary.updatedAt ?? event.summary.createdAt ?? Date.now();

        dispatch({
          type: "update",
          sessionId: event.summary.id,
          state: {
            ...event.summary,
            updatedAt,
          },
        });
        notifyUnreadStatusEvent({
          projectId: event.projectId,
          sessionId: event.summary.id,
          updatedAt,
        });
        return;
      }
      case "session.status":
        dispatchStatuses({
          type: "update",
          sessionId: event.sessionId,
          status: event.status,
        });
        return;
      case "session.question.asked":
        dispatch({
          type: "question-asked",
          sessionId: event.sessionId,
          requestId: event.requestId,
        });
        return;
      case "session.question.replied":
      case "session.question.rejected":
        dispatch({
          type: "question-resolved",
          sessionId: event.sessionId,
          requestId: event.requestId,
        });
        return;
      case "session.deleted":
        dispatch({ type: "update", sessionId: event.sessionId, state: null });
        dispatchStatuses({ type: "remove", sessionId: event.sessionId });
        return;
      case "session.activity": {
        const updatedAt = event.updatedAt;

        dispatch({
          type: "update",
          sessionId: event.sessionId,
          state: { updatedAt },
        });
        notifyUnreadStatusEvent({
          projectId: event.projectId,
          sessionId: event.sessionId,
          updatedAt,
        });
        return;
      }
    }
  }, {
    types: [
      "session.read",
      "session.summary",
      "session.status",
      "session.question.asked",
      "session.question.replied",
      "session.question.rejected",
      "session.deleted",
      "session.activity",
    ] as const,
  });

  return (
    <SessionsActionsContext.Provider value={actionsValue}>
      <SessionsEventsContext.Provider value={eventsValue}>
        <SessionStatusesContext.Provider value={statuses}>
          <SessionsContext.Provider value={sessions}>{children}</SessionsContext.Provider>
        </SessionStatusesContext.Provider>
      </SessionsEventsContext.Provider>
    </SessionsActionsContext.Provider>
  );
}

export function useSessions() {
  const context = useContext(SessionsContext);

  if (!context) {
    throw new Error("useSessions must be used within a SessionsProvider.");
  }

  return context;
}

export function useSession(id: string) {
  const sessions = useSessions();

  return sessions[id] ?? null;
}

function useSessionStatuses() {
  const context = useContext(SessionStatusesContext);

  if (!context) {
    throw new Error("useSessionStatuses must be used within a SessionsProvider.");
  }

  return context;
}

function useSessionSidebarStatus(sessionId: string) {
  const statuses = useSessionStatuses();

  return statuses[getSessionStateId(sessionId)] ?? IDLE_SESSION_STATUS;
}

export function useSessionUnreadStatus(sessionId: string) {
  const session = useSession(getSessionStateId(sessionId));

  if (!session) {
    return false;
  }

  return isSessionUnread(session, session.lastReadAt);
}

export function useSessionSidebarIndicator(sessionId: string) {
  const unread = useSessionUnreadStatus(sessionId);
  const status = useSessionSidebarStatus(sessionId);

  if (!unread) {
    return "none" as const;
  }

  return status.type === "idle" ? "solid" as const : "hollow" as const;
}

export function useMarkSessionReadOptimistic() {
  const context = useContext(SessionsActionsContext);

  if (!context) {
    throw new Error("useMarkSessionReadOptimistic must be used within a SessionsProvider.");
  }

  return context.markReadOptimistic;
}

export function useUnreadStatusEvents(handler: (event: UnreadStatusEvent) => void, filter?: UnreadStatusEventFilter) {
  const context = useContext(SessionsEventsContext);
  const handlerRef = useRef(handler);

  handlerRef.current = handler;

  useEffect(() => {
    if (!context) {
      throw new Error("useUnreadStatusEvents must be used within a SessionsProvider.");
    }

    return context.subscribe((event) => handlerRef.current(event), filter);
  }, [context, filter?.projectId, filter?.sessionId]);
}

export type { SidebarSessionRecord as SessionState };
