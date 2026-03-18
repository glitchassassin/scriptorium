import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import { sessionReadEventSchema, type SessionReadEvent } from "~/lib/session-read-status";

type ReadStatusEventFilter = {
  instanceId?: string;
  sessionId?: string;
};

type ReadStatusEventHandler = (event: SessionReadEvent) => void;

type Subscriber = {
  filter?: ReadStatusEventFilter;
  handler: ReadStatusEventHandler;
};

type ReadStatusEventsContextValue = {
  subscribe: (handler: ReadStatusEventHandler, filter?: ReadStatusEventFilter) => () => void;
};

const ReadStatusEventsContext = createContext<ReadStatusEventsContextValue | null>(null);

function matchesFilter(event: SessionReadEvent, filter?: ReadStatusEventFilter) {
  if (!filter) {
    return true;
  }

  if (filter.instanceId && filter.instanceId !== event.instanceId) {
    return false;
  }

  if (filter.sessionId && filter.sessionId !== event.sessionId) {
    return false;
  }

  return true;
}

export function ReadStatusEventsProvider({ children }: { children: ReactNode }) {
  const sourceRef = useRef<EventSource | null>(null);
  const subscribersRef = useRef(new Map<number, Subscriber>());
  const subscriberIdRef = useRef(0);

  const dispatch = useCallback((event: SessionReadEvent) => {
    for (const subscriber of subscribersRef.current.values()) {
      if (!matchesFilter(event, subscriber.filter)) {
        continue;
      }

      subscriber.handler(event);
    }
  }, []);

  useEffect(() => {
    const source = new EventSource("/session-read-status/events");
    sourceRef.current = source;
    source.onmessage = (message) => {
      try {
        const parsed = sessionReadEventSchema.safeParse(JSON.parse(message.data) as unknown);

        if (!parsed.success) {
          console.error("[session read events] Event did not match its schema.", {
            error: parsed.error.format(),
            raw: message.data,
          });
          return;
        }

        dispatch(parsed.data);
      } catch (error) {
        console.error("[session read events] Failed to parse SSE payload.", {
          error,
          raw: message.data,
        });
      }
    };

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [dispatch]);

  const subscribe = useCallback<ReadStatusEventsContextValue["subscribe"]>((handler, filter) => {
    const subscriberId = subscriberIdRef.current;
    subscriberIdRef.current += 1;

    subscribersRef.current.set(subscriberId, { filter, handler });

    return () => {
      subscribersRef.current.delete(subscriberId);
    };
  }, []);

  const value = useMemo<ReadStatusEventsContextValue>(
    () => ({ subscribe }),
    [subscribe],
  );

  return <ReadStatusEventsContext.Provider value={value}>{children}</ReadStatusEventsContext.Provider>;
}

export function useReadStatusEvents(handler: ReadStatusEventHandler, filter?: ReadStatusEventFilter) {
  const context = useContext(ReadStatusEventsContext);
  const handlerRef = useRef(handler);

  handlerRef.current = handler;

  useEffect(() => {
    if (!context) {
      throw new Error("useReadStatusEvents must be used within a ReadStatusEventsProvider.");
    }

    return context.subscribe((event) => handlerRef.current(event), filter);
  }, [context, filter?.instanceId, filter?.sessionId]);
}

export type { ReadStatusEventFilter, SessionReadEvent };
