import { useEffect, useMemo, useState } from "react";

import { useInstanceEvents } from "~/components/events/instance-events-provider";
import {
  filterRecentSessions,
  sortSidebarInstances,
  toSessionSummary,
  type SidebarInstanceRecord,
} from "~/lib/instances/sidebar";

import { SidebarInstanceItem } from "./sidebar-instance-item";

type SidebarInstancesNavProps = {
  instances: SidebarInstanceRecord[];
};

function filterVisibleInstances(instances: SidebarInstanceRecord[]) {
  return sortSidebarInstances(instances).filter((instance) => instance.recentSessions.length > 0);
}

export function SidebarInstancesNav({ instances }: SidebarInstancesNavProps) {
  const [allInstances, setAllInstances] = useState(() => sortSidebarInstances(instances));
  const eventTypes = useMemo(() => ["session.created", "session.updated", "session.deleted"] as const, []);

  useEffect(() => {
    setAllInstances(sortSidebarInstances(instances));
  }, [instances]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setAllInstances((currentInstances) =>
        sortSidebarInstances(currentInstances.map((instance) => ({
          ...instance,
          recentSessions: filterRecentSessions(instance.recentSessions),
        }))),
      );
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  useInstanceEvents(
    (event) => {
      setAllInstances((currentInstances) => {
        const instanceIndex = currentInstances.findIndex((instance) => instance.id === event.instanceId);

        if (instanceIndex < 0) {
          return currentInstances;
        }

        const instance = currentInstances[instanceIndex];

        if (!instance) {
          return currentInstances;
        }

        switch (event.type) {
          case "session.deleted": {
            const nextInstances = [...currentInstances];
            nextInstances[instanceIndex] = {
              ...instance,
              recentSessions: filterRecentSessions(
                instance.recentSessions.filter((session) => session.id !== event.properties.info.id),
              ),
            };

            return sortSidebarInstances(nextInstances);
          }

          case "session.created":
          case "session.updated": {
            const nextInstances = [...currentInstances];
            nextInstances[instanceIndex] = {
              ...instance,
              recentSessions: filterRecentSessions([
                ...instance.recentSessions.filter((session) => session.id !== event.properties.info.id),
                toSessionSummary(event.properties.info),
              ]),
            };

            return sortSidebarInstances(nextInstances);
          }

          default:
            return currentInstances;
        }
      });
    },
    { types: eventTypes },
  );

  const visibleInstances = filterVisibleInstances(allInstances);

  if (!visibleInstances.length) {
    return null;
  }

  return (
    <ul className="space-y-1">
      {visibleInstances.map((instance) => (
        <SidebarInstanceItem instance={instance} key={instance.id} />
      ))}
    </ul>
  );
}
