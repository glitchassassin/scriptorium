import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import { useCoalescedRevalidation } from "~/components/events/use-coalesced-revalidation";
import { PersistentEventSource } from "~/lib/events/persistent-event-source";
import { sessionEventSchema, type SessionEvent, type SessionEventType } from "~/lib/session-events";

type SessionEventFilter<TTypes extends readonly SessionEventType[] | undefined = readonly SessionEventType[] | undefined> = {
  instanceId?: string;
  sessionId?: string;
  types?: TTypes;
};

type FilteredSessionEvent<TTypes extends readonly SessionEventType[] | undefined> = TTypes extends readonly SessionEventType[]
  ? Extract<SessionEvent, { type: TTypes[number] }>
  : SessionEvent;

type SessionEventHandler<TTypes extends readonly SessionEventType[] | undefined = undefined> = (
  event: FilteredSessionEvent<TTypes>,
) => void;

type Subscriber = {
  filter?: SessionEventFilter;
  handler: SessionEventHandler<readonly SessionEventType[] | undefined>;
};

type SessionEventsContextValue = {
  subscribe: <TTypes extends readonly SessionEventType[] | undefined = undefined>(
    handler: SessionEventHandler<TTypes>,
    filter?: SessionEventFilter<TTypes>,
  ) => () => void;
};

const SessionEventsContext = createContext<SessionEventsContextValue | null>(null);

function getSessionId(event: SessionEvent) {
  switch (event.type) {
    case "session.read":
    case "session.activity":
    case "session.deleted":
      return event.sessionId;
    case "session.summary":
      return event.summary.id;
  }
}

function matchesFilter(event: SessionEvent, filter?: SessionEventFilter) {
  if (!filter) {
    return true;
  }

  if (filter.types?.length && !filter.types.includes(event.type)) {
    return false;
  }

  if (filter.instanceId) {
    if (!("instanceId" in event) || event.instanceId !== filter.instanceId) {
      return false;
    }
  }

  if (filter.sessionId && getSessionId(event) !== filter.sessionId) {
    return false;
  }

  return true;
}

export function SessionEventsProvider({ children }: { children: ReactNode }) {
  const sourceRef = useRef<PersistentEventSource | null>(null);
  const subscribersRef = useRef(new Map<number, Subscriber>());
  const subscriberIdRef = useRef(0);
  const revalidateOnReconnect = useCoalescedRevalidation();

  const dispatch = useCallback((event: SessionEvent) => {
    for (const subscriber of subscribersRef.current.values()) {
      if (!matchesFilter(event, subscriber.filter)) {
        continue;
      }

      subscriber.handler(event);
    }
  }, []);

  useEffect(() => {
    const source = new PersistentEventSource("/session-events/events", {
      onReconnect: () => {
        revalidateOnReconnect();
      },
      onMessage: (message) => {
        try {
          const parsed = sessionEventSchema.safeParse(JSON.parse(message.data) as unknown);

          if (!parsed.success) {
            console.error("[session events] Event did not match its schema.", {
              error: parsed.error.format(),
              raw: message.data,
            });
            return;
          }

          dispatch(parsed.data);
        } catch (error) {
          console.error("[session events] Failed to parse SSE payload.", {
            error,
            raw: message.data,
          });
        }
      },
    });
    sourceRef.current = source;

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [dispatch, revalidateOnReconnect]);

  const subscribe = useCallback<SessionEventsContextValue["subscribe"]>((handler, filter) => {
    const subscriberId = subscriberIdRef.current;
    subscriberIdRef.current += 1;

    subscribersRef.current.set(subscriberId, { filter, handler });

    return () => {
      subscribersRef.current.delete(subscriberId);
    };
  }, []);

  const value = useMemo<SessionEventsContextValue>(() => ({ subscribe }), [subscribe]);

  return <SessionEventsContext.Provider value={value}>{children}</SessionEventsContext.Provider>;
}

export function useSessionEvents<TTypes extends readonly SessionEventType[] | undefined = undefined>(
  handler: SessionEventHandler<TTypes>,
  filter?: SessionEventFilter<TTypes>,
) {
  const context = useContext(SessionEventsContext);
  const handlerRef = useRef(handler);
  const typesKey = filter?.types?.join(",") ?? "";

  handlerRef.current = handler;

  useEffect(() => {
    if (!context) {
      throw new Error("useSessionEvents must be used within a SessionEventsProvider.");
    }

    return context.subscribe((event) => handlerRef.current(event as FilteredSessionEvent<TTypes>), filter);
  }, [context, filter?.instanceId, filter?.sessionId, typesKey]);
}

export type { FilteredSessionEvent, SessionEvent, SessionEventFilter };
