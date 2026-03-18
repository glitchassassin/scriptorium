import { useEffect, useMemo, useState } from "react";

import {
  filterRecentSessions,
  isSessionUnread,
  SIDEBAR_SESSION_LIMIT,
} from "~/lib/instances/sidebar";
import { useInstances, type InstanceState } from "~/store/instances-provider";
import { useSessions } from "~/store/sessions-provider";

type VisibleInstanceState = InstanceState & {
  sessionIds: string[];
};

function sortInstances<TInstance extends Pick<InstanceState, "name">>(instances: TInstance[]) {
  return [...instances].sort((left, right) => left.name.localeCompare(right.name));
}

export function useVisibleSidebarInstances() {
  const instances = useInstances();
  const sessions = useSessions();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return useMemo(() => {
    return sortInstances(Object.values(instances).map((instance) => {
      const visibleSessionIds = filterRecentSessions(
        instance.sessionIds
          .map((sessionId) => sessions[sessionId])
          .filter((session): session is NonNullable<typeof session> => session !== undefined),
        now,
      ).map((session) => session.id);

      return {
        ...instance,
        sessionIds: visibleSessionIds,
      } satisfies VisibleInstanceState;
    })).filter((instance) => instance.sessionIds.length > 0);
  }, [instances, now, sessions]);
}

export function useHasVisibleUnreadSessions() {
  const instances = useVisibleSidebarInstances();
  const sessions = useSessions();

  return instances.some((instance) =>
    instance.sessionIds.slice(0, SIDEBAR_SESSION_LIMIT).some((sessionId) => {
      const session = sessions[sessionId];

      return session ? isSessionUnread(session, session.lastReadAt) : false;
    }),
  );
}

export type { VisibleInstanceState };
