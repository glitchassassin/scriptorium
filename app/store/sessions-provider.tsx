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
} from "~/lib/instances/sidebar";

type SessionsContextValue = Record<string, SidebarSessionRecord>;

type UnreadStatusEvent = {
  instanceId: string;
  sessionId: string;
  updatedAt: number;
};

type UnreadStatusEventFilter = {
  instanceId?: string;
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
  | { type: "update"; sessionId: string; state: Partial<SidebarSessionRecord> | null };

const SessionsContext = createContext<SessionsContextValue | null>(null);
const SessionsActionsContext = createContext<SessionsActionsContextValue | null>(null);
const SessionsEventsContext = createContext<SessionsEventsContextValue | null>(null);

export function getSessionStateId(sessionId: string) {
  return sessionId;
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

      const next = {
        id: action.sessionId,
        parentID: previous?.parentID ?? null,
        title: previous?.title ?? null,
        directory: previous?.directory ?? null,
        createdAt: previous?.createdAt ?? null,
        updatedAt: previous?.updatedAt ?? null,
        lastReadAt: previous?.lastReadAt ?? null,
        ...nextPartial,
      } satisfies SidebarSessionRecord;

      if (
        previous?.parentID === next.parentID
        &&
        previous?.title === next.title
        && previous?.directory === next.directory
        && previous?.createdAt === next.createdAt
        && previous?.updatedAt === next.updatedAt
        && previous?.lastReadAt === next.lastReadAt
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

export function SessionsProvider({ children, initialSessions }: { children: ReactNode; initialSessions: SessionsContextValue }) {
  const [sessions, dispatch] = useReducer(sessionsReducer, initialSessions);
  const subscribersRef = useRef(new Map<number, { filter?: UnreadStatusEventFilter; handler: (event: UnreadStatusEvent) => void }>());
  const subscriberIdRef = useRef(0);

  useEffect(() => {
    dispatch({ type: "reset", sessions: initialSessions });
  }, [initialSessions]);

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
      if (subscriber.filter?.instanceId && subscriber.filter.instanceId !== event.instanceId) {
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
          instanceId: event.instanceId,
          sessionId: event.summary.id,
          updatedAt,
        });
        return;
      }
      case "session.deleted":
        dispatch({ type: "update", sessionId: event.sessionId, state: null });
        return;
      case "session.activity": {
        const updatedAt = event.updatedAt;
        dispatch({
          type: "update",
          sessionId: event.sessionId,
          state: { updatedAt },
        });
        notifyUnreadStatusEvent({
          instanceId: event.instanceId,
          sessionId: event.sessionId,
          updatedAt,
        });
        return;
      }
    }
  }, {
    types: ["session.read", "session.summary", "session.deleted", "session.activity"] as const,
  });

  return (
    <SessionsActionsContext.Provider value={actionsValue}>
      <SessionsEventsContext.Provider value={eventsValue}>
        <SessionsContext.Provider value={sessions}>{children}</SessionsContext.Provider>
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

export function useSessionUnreadStatus(sessionId: string) {
  const session = useSession(getSessionStateId(sessionId));

  if (!session) {
    return false;
  }

  return isSessionUnread(session, session.lastReadAt);
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
  }, [context, filter?.instanceId, filter?.sessionId]);
}

export type { SidebarSessionRecord as SessionState };
