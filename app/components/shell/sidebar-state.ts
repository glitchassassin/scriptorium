import { useEffect, useMemo, useState } from "react";

import {
  filterRecentSessions,
  isRootSession,
  isSessionUnread,
  SIDEBAR_SESSION_LIMIT,
} from "~/lib/projects/sidebar";
import { type ProjectState, useProjects } from "~/store/projects-provider";
import { useSessions } from "~/store/sessions-provider";

type VisibleProjectState = ProjectState & {
  sessionIds: string[];
};

function sortProjects<TProject extends Pick<ProjectState, "name">>(projects: TProject[]) {
  return [...projects].sort((left, right) => left.name.localeCompare(right.name));
}

export function useVisibleSidebarProjects() {
  const projects = useProjects();
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
    return sortProjects(Object.values(projects).map((project) => {
      const visibleSessionIds = filterRecentSessions(
        project.sessionIds
          .map((sessionId) => sessions[sessionId])
          .filter((session): session is NonNullable<typeof session> => session !== undefined)
          // The sidebar reflects the root session only. Subagent sessions do not become
          // actionable until they report back into the main session, so child activity
          // should not change sidebar visibility or unread state on its own.
          .filter(isRootSession),
        now,
      ).map((session) => session.id);

      return {
        ...project,
        sessionIds: visibleSessionIds,
      } satisfies VisibleProjectState;
    })).filter((project) => project.sessionIds.length > 0);
  }, [now, projects, sessions]);
}

export function useHasVisibleUnreadProjectSessions() {
  const projects = useVisibleSidebarProjects();
  const sessions = useSessions();

  return projects.some((project) =>
    project.sessionIds.slice(0, SIDEBAR_SESSION_LIMIT).some((sessionId) => {
      const session = sessions[sessionId];

      return session ? isSessionUnread(session, session.lastReadAt) : false;
    }),
  );
}

export type { VisibleProjectState };
