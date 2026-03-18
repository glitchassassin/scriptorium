import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from "react";

import { useInstanceEvents } from "~/components/events/instance-events-provider";
import { type SidebarInstanceRecord } from "~/lib/instances/sidebar";

type InstanceState = Pick<SidebarInstanceRecord, "id" | "name" | "status"> & {
  sessionIds: string[];
};

type InstancesContextValue = Record<string, InstanceState>;

type InstancesAction =
  | { type: "reset"; instances: InstancesContextValue }
  | { type: "add-session"; instanceId: string; sessionId: string }
  | { type: "remove-session"; instanceId: string; sessionId: string };

const InstancesContext = createContext<InstancesContextValue | null>(null);

function sortInstances<TInstance extends Pick<InstanceState, "name">>(instances: TInstance[]) {
  return [...instances].sort((left, right) => left.name.localeCompare(right.name));
}

function instancesReducer(current: InstancesContextValue, action: InstancesAction) {
  switch (action.type) {
    case "reset":
      return action.instances;
    case "add-session": {
      const instance = current[action.instanceId];

      if (!instance || instance.sessionIds.includes(action.sessionId)) {
        return current;
      }

      return {
        ...current,
        [action.instanceId]: {
          ...instance,
          sessionIds: [...instance.sessionIds, action.sessionId],
        },
      };
    }
    case "remove-session": {
      const instance = current[action.instanceId];

      if (!instance || !instance.sessionIds.includes(action.sessionId)) {
        return current;
      }

      return {
        ...current,
        [action.instanceId]: {
          ...instance,
          sessionIds: instance.sessionIds.filter((sessionId) => sessionId !== action.sessionId),
        },
      };
    }
  }
}

export function getInitialInstances(instances: SidebarInstanceRecord[]) {
  return Object.fromEntries(
    instances.map((instance) => [
      instance.id,
      {
        id: instance.id,
        name: instance.name,
        status: instance.status,
        sessionIds: instance.recentSessions.map((session) => session.id),
      } satisfies InstanceState,
    ] as const),
  ) as InstancesContextValue;
}

export function InstancesProvider({ children, initialInstances }: { children: ReactNode; initialInstances: InstancesContextValue }) {
  const [instances, dispatch] = useReducer(instancesReducer, initialInstances);

  useEffect(() => {
    dispatch({ type: "reset", instances: initialInstances });
  }, [initialInstances]);

  useInstanceEvents((event) => {
    switch (event.type) {
      case "session.created":
      case "session.updated":
        dispatch({
          type: "add-session",
          instanceId: event.instanceId,
          sessionId: event.properties.info.id,
        });
        return;
      case "session.deleted":
        dispatch({
          type: "remove-session",
          instanceId: event.instanceId,
          sessionId: event.properties.info.id,
        });
    }
  }, {
    types: ["session.created", "session.updated", "session.deleted"] as const,
  });

  return <InstancesContext.Provider value={instances}>{children}</InstancesContext.Provider>;
}

export function useInstances() {
  const context = useContext(InstancesContext);

  if (!context) {
    throw new Error("useInstances must be used within an InstancesProvider.");
  }

  return context;
}

export type { InstanceState };
