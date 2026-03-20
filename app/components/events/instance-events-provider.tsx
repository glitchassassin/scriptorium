import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import {
  parseOpencodeEvent,
  type OpencodeEvent,
  type OpencodeKnownEventType,
} from "~/lib/opencode/events";
import { PersistentEventSource } from "~/lib/events/persistent-event-source";
import { useEventStreamReconnectRevalidation } from "~/components/events/use-event-stream-reconnect-revalidation";

type InstanceEvent = {
  instanceId: string;
} & OpencodeEvent;

type InstanceEventFilter<TTypes extends readonly OpencodeKnownEventType[] | undefined = readonly OpencodeKnownEventType[] | undefined> = {
  instanceId?: string;
  sessionId?: string;
  types?: TTypes;
};

type FilteredInstanceEvent<TTypes extends readonly OpencodeKnownEventType[] | undefined> = TTypes extends readonly OpencodeKnownEventType[]
  ? Extract<InstanceEvent, { type: TTypes[number] }>
  : InstanceEvent;

type InstanceEventHandler<TTypes extends readonly OpencodeKnownEventType[] | undefined = undefined> = (
  event: FilteredInstanceEvent<TTypes>,
) => void;

type Subscriber = {
  filter?: InstanceEventFilter;
  handler: InstanceEventHandler<readonly OpencodeKnownEventType[] | undefined>;
};

type InstanceEventsContextValue = {
  subscribe: <TTypes extends readonly OpencodeKnownEventType[] | undefined = undefined>(
    handler: InstanceEventHandler<TTypes>,
    filter?: InstanceEventFilter<TTypes>,
  ) => () => void;
};

const InstanceEventsContext = createContext<InstanceEventsContextValue | null>(null);

function matchesFilter(event: InstanceEvent, filter?: InstanceEventFilter) {
  if (!filter) {
    return true;
  }

  if (filter.instanceId && filter.instanceId !== event.instanceId) {
    return false;
  }

  if (filter.sessionId) {
    const eventSessionId = getEventSessionId(event);

    if (eventSessionId !== filter.sessionId) {
      return false;
    }
  }

  if (filter.types?.length && !filter.types.includes(event.type)) {
    return false;
  }

  return true;
}

function getEventSessionId(event: InstanceEvent) {
  switch (event.type) {
    case "session.created":
    case "session.updated":
    case "session.deleted":
      return event.properties.info.id;
    case "session.status":
      return event.properties.sessionID;
    case "session.error":
      return event.properties.sessionID ?? null;
    case "session.diff":
      return event.properties.sessionID;
    case "message.updated":
      return event.properties.info.sessionID;
    case "message.removed":
      return event.properties.sessionID;
    case "message.part.updated":
      return event.properties.part.sessionID;
    case "message.part.delta":
      return event.properties.sessionID;
    case "message.part.removed":
      return event.properties.sessionID;
    case "permission.asked":
      return event.properties.sessionID;
    case "permission.replied":
      return event.properties.sessionID ?? null;
    default:
      return null;
  }
}

export function InstanceEventsProvider({ children, instanceIds }: { children: ReactNode; instanceIds: string[] }) {
  const sourcesRef = useRef(new Map<string, PersistentEventSource>());
  const subscribersRef = useRef(new Map<number, Subscriber>());
  const subscriberIdRef = useRef(0);
  const instanceIdsKey = useMemo(() => [...instanceIds].sort().join(","), [instanceIds]);
  const normalizedInstanceIds = useMemo(() => [...new Set(instanceIds)].sort(), [instanceIdsKey]);
  const revalidateOnReconnect = useEventStreamReconnectRevalidation();

  const dispatch = useCallback((event: InstanceEvent) => {
    for (const subscriber of subscribersRef.current.values()) {
      if (!matchesFilter(event, subscriber.filter)) {
        continue;
      }

      subscriber.handler(event);
    }
  }, []);

  useEffect(() => {
    const nextIds = new Set(normalizedInstanceIds);

    for (const [instanceId, source] of sourcesRef.current) {
      if (nextIds.has(instanceId)) {
        continue;
      }

      source.close();
      sourcesRef.current.delete(instanceId);
    }

    for (const instanceId of normalizedInstanceIds) {
      if (sourcesRef.current.has(instanceId)) {
        continue;
      }

      const source = new PersistentEventSource(`/instances/${instanceId}/proxy/event`, {
        onReconnect: () => {
          revalidateOnReconnect();
        },
        onMessage: (message) => {
          try {
            const result = parseOpencodeEvent(JSON.parse(message.data) as unknown);

            if (result.kind === "unknown") {
              console.warn(`[opencode events] No schema registered for event type \"${result.eventType}\".`, {
                event: result.data,
                instanceId,
              });
              return;
            }

            if (result.kind === "invalid") {
              console.error(
                `[opencode events] Event ${result.eventType ? `\"${result.eventType}\" ` : ""}did not match its schema.`,
                {
                  error: result.error.format(),
                  instanceId,
                  raw: message.data,
                },
              );
              return;
            }

            dispatch({
              instanceId,
              ...result.data,
            });
          } catch (error) {
            console.error("[opencode events] Failed to parse SSE payload.", {
              error,
              instanceId,
              raw: message.data,
            });
          }
        },
      });
      sourcesRef.current.set(instanceId, source);
    }

    return () => {
      for (const source of sourcesRef.current.values()) {
        source.close();
      }
      sourcesRef.current.clear();
    };
  }, [dispatch, instanceIdsKey, normalizedInstanceIds, revalidateOnReconnect]);

  const subscribe = useCallback<InstanceEventsContextValue["subscribe"]>((handler, filter) => {
    const subscriberId = subscriberIdRef.current;
    subscriberIdRef.current += 1;

    subscribersRef.current.set(subscriberId, {
      filter,
      handler: handler as InstanceEventHandler<readonly OpencodeKnownEventType[] | undefined>,
    });

    return () => {
      subscribersRef.current.delete(subscriberId);
    };
  }, []);

  const value = useMemo<InstanceEventsContextValue>(
    () => ({
      subscribe,
    }),
    [subscribe],
  );

  return <InstanceEventsContext.Provider value={value}>{children}</InstanceEventsContext.Provider>;
}

export function useInstanceEvents<TTypes extends readonly OpencodeKnownEventType[] | undefined = undefined>(
  handler: InstanceEventHandler<TTypes>,
  filter?: InstanceEventFilter<TTypes>,
) {
  const context = useContext(InstanceEventsContext);
  const handlerRef = useRef(handler);
  const typesKey = filter?.types?.join(",") ?? "";

  handlerRef.current = handler;

  useEffect(() => {
    if (!context) {
      throw new Error("useInstanceEvents must be used within an InstanceEventsProvider.");
    }

    return context.subscribe((event) => handlerRef.current(event as FilteredInstanceEvent<TTypes>), filter);
  }, [context, filter?.instanceId, filter?.sessionId, typesKey]);
}

export type { FilteredInstanceEvent, InstanceEvent, InstanceEventFilter };
