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
import {
  parseOpencodeGlobalEvent,
  type OpencodeGlobalEvent,
  type OpencodeKnownEventType,
} from "~/lib/opencode/events";

export type GlobalEvent = OpencodeGlobalEvent;

export type GlobalEventFilter<TTypes extends readonly OpencodeKnownEventType[] | undefined = readonly OpencodeKnownEventType[] | undefined> = {
  directory?: string;
  types?: TTypes;
};

export type FilteredGlobalEvent<TTypes extends readonly OpencodeKnownEventType[] | undefined> = TTypes extends readonly OpencodeKnownEventType[]
  ? Extract<GlobalEvent, { payload: { type: TTypes[number] } }>
  : GlobalEvent;

type GlobalEventHandler<TTypes extends readonly OpencodeKnownEventType[] | undefined = undefined> = (
  event: FilteredGlobalEvent<TTypes>,
) => void;

type Subscriber = {
  filter?: GlobalEventFilter;
  handler: GlobalEventHandler<readonly OpencodeKnownEventType[] | undefined>;
};

type GlobalEventsContextValue = {
  subscribe: <TTypes extends readonly OpencodeKnownEventType[] | undefined = undefined>(
    handler: GlobalEventHandler<TTypes>,
    filter?: GlobalEventFilter<TTypes>,
  ) => () => void;
};

const GlobalEventsContext = createContext<GlobalEventsContextValue | null>(null);

function matchesFilter(event: GlobalEvent, filter?: GlobalEventFilter) {
  if (!filter) {
    return true;
  }

  if (filter.directory && filter.directory !== event.directory) {
    return false;
  }

  if (filter.types?.length && !filter.types.includes(event.payload.type)) {
    return false;
  }

  return true;
}

export function GlobalEventsProvider({ children }: { children: ReactNode }) {
  const sourceRef = useRef<PersistentEventSource | null>(null);
  const subscribersRef = useRef(new Map<number, Subscriber>());
  const subscriberIdRef = useRef(0);
  const revalidateOnReconnect = useCoalescedRevalidation();

  const dispatch = useCallback((event: GlobalEvent) => {
    for (const subscriber of subscribersRef.current.values()) {
      if (!matchesFilter(event, subscriber.filter)) {
        continue;
      }

      subscriber.handler(event);
    }
  }, []);

  useEffect(() => {
    const source = new PersistentEventSource("/global-events/events", {
      onReconnect: () => {
        revalidateOnReconnect();
      },
      onMessage: (message) => {
        try {
          const result = parseOpencodeGlobalEvent(JSON.parse(message.data) as unknown);

          if (result.kind === "unknown") {
            console.warn(`[global events] No schema registered for event type "${result.eventType}".`, {
              directory: result.data.directory,
              event: result.data.payload,
            });
            return;
          }

          if (result.kind === "invalid") {
            console.error(
              `[global events] Event ${result.eventType ? `"${result.eventType}" ` : ""}did not match its schema.`,
              {
                error: result.error.format(),
                raw: message.data,
              },
            );
            return;
          }

          dispatch(result.data);
        } catch (error) {
          console.error("[global events] Failed to parse SSE payload.", {
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

  const subscribe = useCallback<GlobalEventsContextValue["subscribe"]>((handler, filter) => {
    const id = subscriberIdRef.current;
    subscriberIdRef.current += 1;
    subscribersRef.current.set(id, { filter, handler });

    return () => {
      subscribersRef.current.delete(id);
    };
  }, []);

  const value = useMemo<GlobalEventsContextValue>(() => ({ subscribe }), [subscribe]);

  return <GlobalEventsContext.Provider value={value}>{children}</GlobalEventsContext.Provider>;
}

export function useGlobalEvents<TTypes extends readonly OpencodeKnownEventType[] | undefined = undefined>(
  handler: GlobalEventHandler<TTypes>,
  filter?: GlobalEventFilter<TTypes>,
) {
  const context = useContext(GlobalEventsContext);
  const handlerRef = useRef(handler);
  const typesKey = filter?.types?.join(",") ?? "";

  handlerRef.current = handler;

  useEffect(() => {
    if (!context) {
      throw new Error("useGlobalEvents must be used within a GlobalEventsProvider.");
    }

    return context.subscribe((event) => handlerRef.current(event as FilteredGlobalEvent<TTypes>), filter);
  }, [context, filter?.directory, typesKey]);
}
