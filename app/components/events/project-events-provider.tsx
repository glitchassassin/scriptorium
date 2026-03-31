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
import { useCoalescedRevalidation } from "~/components/events/use-coalesced-revalidation";

export type ProjectEvent = {
  projectId: string;
} & OpencodeEvent;

export type ProjectEventFilter<TTypes extends readonly OpencodeKnownEventType[] | undefined = readonly OpencodeKnownEventType[] | undefined> = {
  projectId?: string;
  sessionId?: string;
  types?: TTypes;
};

export type FilteredProjectEvent<TTypes extends readonly OpencodeKnownEventType[] | undefined> = TTypes extends readonly OpencodeKnownEventType[]
  ? Extract<ProjectEvent, { type: TTypes[number] }>
  : ProjectEvent;

type ProjectEventHandler<TTypes extends readonly OpencodeKnownEventType[] | undefined = undefined> = (
  event: FilteredProjectEvent<TTypes>,
) => void;

type Subscriber = {
  filter?: ProjectEventFilter;
  handler: ProjectEventHandler<readonly OpencodeKnownEventType[] | undefined>;
};

type ProjectEventsContextValue = {
  subscribe: <TTypes extends readonly OpencodeKnownEventType[] | undefined = undefined>(
    handler: ProjectEventHandler<TTypes>,
    filter?: ProjectEventFilter<TTypes>,
  ) => () => void;
};

const ProjectEventsContext = createContext<ProjectEventsContextValue | null>(null);

function matchesFilter(event: ProjectEvent, filter?: ProjectEventFilter) {
  if (!filter) {
    return true;
  }

  if (filter.projectId && filter.projectId !== event.projectId) {
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

function getEventSessionId(event: ProjectEvent) {
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
    case "question.asked":
      return event.properties.sessionID;
    case "question.replied":
    case "question.rejected":
      return event.properties.sessionID;
    default:
      return null;
  }
}

export function ProjectEventsProvider({ children, projectIds }: { children: ReactNode; projectIds: string[] }) {
  const sourcesRef = useRef(new Map<string, PersistentEventSource>());
  const subscribersRef = useRef(new Map<number, Subscriber>());
  const subscriberIdRef = useRef(0);
  const projectIdsKey = useMemo(() => [...projectIds].sort().join(","), [projectIds]);
  const normalizedProjectIds = useMemo(() => [...new Set(projectIds)].sort(), [projectIdsKey]);
  const revalidateOnReconnect = useCoalescedRevalidation();

  const dispatch = useCallback((event: ProjectEvent) => {
    for (const subscriber of subscribersRef.current.values()) {
      if (!matchesFilter(event, subscriber.filter)) {
        continue;
      }

      subscriber.handler(event);
    }
  }, []);

  useEffect(() => {
    const nextIds = new Set(normalizedProjectIds);

    for (const [projectId, source] of sourcesRef.current) {
      if (nextIds.has(projectId)) {
        continue;
      }

      source.close();
      sourcesRef.current.delete(projectId);
    }

    for (const projectId of normalizedProjectIds) {
      if (sourcesRef.current.has(projectId)) {
        continue;
      }

      const source = new PersistentEventSource(`/projects/${projectId}/proxy/event`, {
        onReconnect: () => {
          revalidateOnReconnect();
        },
        onMessage: (message) => {
          try {
            const result = parseOpencodeEvent(JSON.parse(message.data) as unknown);

            if (result.kind === "unknown") {
              console.warn(`[opencode events] No schema registered for event type \"${result.eventType}\".`, {
                event: result.data,
                projectId,
              });
              return;
            }

            if (result.kind === "invalid") {
              console.error(
                `[opencode events] Event ${result.eventType ? `\"${result.eventType}\" ` : ""}did not match its schema.`,
                {
                  error: result.error.format(),
                  projectId,
                  raw: message.data,
                },
              );
              return;
            }

            dispatch({
              projectId,
              ...result.data,
            });
          } catch (error) {
            console.error("[opencode events] Failed to parse SSE payload.", {
              error,
              projectId,
              raw: message.data,
            });
          }
        },
      });
      sourcesRef.current.set(projectId, source);
    }

    return () => {
      for (const source of sourcesRef.current.values()) {
        source.close();
      }
      sourcesRef.current.clear();
    };
  }, [dispatch, normalizedProjectIds, projectIdsKey, revalidateOnReconnect]);

  const subscribe = useCallback<ProjectEventsContextValue["subscribe"]>((handler, filter) => {
    const subscriberId = subscriberIdRef.current;
    subscriberIdRef.current += 1;

    subscribersRef.current.set(subscriberId, {
      filter,
      handler: handler as ProjectEventHandler<readonly OpencodeKnownEventType[] | undefined>,
    });

    return () => {
      subscribersRef.current.delete(subscriberId);
    };
  }, []);

  const value = useMemo<ProjectEventsContextValue>(() => ({ subscribe }), [subscribe]);

  return <ProjectEventsContext.Provider value={value}>{children}</ProjectEventsContext.Provider>;
}

export function useProjectEvents<TTypes extends readonly OpencodeKnownEventType[] | undefined = undefined>(
  handler: ProjectEventHandler<TTypes>,
  filter?: ProjectEventFilter<TTypes>,
) {
  const context = useContext(ProjectEventsContext);
  const handlerRef = useRef(handler);
  const typesKey = filter?.types?.join(",") ?? "";

  handlerRef.current = handler;

  useEffect(() => {
    if (!context) {
      throw new Error("useProjectEvents must be used within a ProjectEventsProvider.");
    }

    return context.subscribe((event) => handlerRef.current(event as FilteredProjectEvent<TTypes>), filter);
  }, [context, filter?.projectId, filter?.sessionId, typesKey]);
}
