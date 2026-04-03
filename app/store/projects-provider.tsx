import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

import { useSessionEvents } from "~/components/events/session-events-provider";
import { isRootSession, type SidebarProjectRecord } from "~/lib/projects/sidebar";

export type ProjectState = Pick<SidebarProjectRecord, "id" | "name" | "directory"> & {
  sessionIds: string[];
};

type ProjectsContextValue = Record<string, ProjectState>;

type ProjectsAction =
  | { type: "reset"; projects: ProjectsContextValue }
  | { type: "remove-project"; projectId: string }
  | { type: "upsert-project"; project: Pick<ProjectState, "id" | "name" | "directory"> }
  | { type: "add-session"; projectId: string; sessionId: string }
  | { type: "remove-session"; projectId: string; sessionId: string };

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

function sortProjects<TProject extends Pick<ProjectState, "name">>(projects: TProject[]) {
  return [...projects].sort((left, right) => left.name.localeCompare(right.name));
}

function projectsReducer(current: ProjectsContextValue, action: ProjectsAction) {
  switch (action.type) {
    case "reset":
      return action.projects;
    case "remove-project": {
      if (!(action.projectId in current)) {
        return current;
      }

      const { [action.projectId]: _removed, ...rest } = current;
      return rest;
    }
    case "upsert-project": {
      const previous = current[action.project.id];

      if (
        previous?.name === action.project.name
        && previous?.directory === action.project.directory
      ) {
        return current;
      }

      return {
        ...current,
        [action.project.id]: {
          id: action.project.id,
          name: action.project.name,
          directory: action.project.directory,
          sessionIds: previous?.sessionIds ?? [],
        },
      };
    }
    case "add-session": {
      const project = current[action.projectId];

      if (!project || project.sessionIds.includes(action.sessionId)) {
        return current;
      }

      return {
        ...current,
        [action.projectId]: {
          ...project,
          sessionIds: [...project.sessionIds, action.sessionId],
        },
      };
    }
    case "remove-session": {
      const project = current[action.projectId];

      if (!project || !project.sessionIds.includes(action.sessionId)) {
        return current;
      }

      return {
        ...current,
        [action.projectId]: {
          ...project,
          sessionIds: project.sessionIds.filter((sessionId) => sessionId !== action.sessionId),
        },
      };
    }
  }
}

export function getInitialProjects(projects: SidebarProjectRecord[]) {
  return Object.fromEntries(
    sortProjects(projects).map((project) => [
      project.id,
        {
          id: project.id,
          name: project.name,
          directory: project.directory,
          sessionIds: project.recentSessions.map((session) => session.id),
        } satisfies ProjectState,
      ] as const),
  ) as ProjectsContextValue;
}

export function ProjectsProvider({ children, initialProjects }: { children: ReactNode; initialProjects: ProjectsContextValue }) {
  const [projects, dispatch] = useReducer(projectsReducer, initialProjects);

  useEffect(() => {
    dispatch({ type: "reset", projects: initialProjects });
  }, [initialProjects]);

  useSessionEvents((event) => {
    switch (event.type) {
      case "project.changed":
        dispatch({
          type: "upsert-project",
          project: event.project,
        });
        return;
      case "project.removed":
        dispatch({ type: "remove-project", projectId: event.projectId });
        return;
      case "session.summary":
        if (!isRootSession(event.summary)) {
          return;
        }

        dispatch({
          type: "add-session",
          projectId: event.projectId,
          sessionId: event.summary.id,
        });
        return;
      case "session.deleted":
        dispatch({
          type: "remove-session",
          projectId: event.projectId,
          sessionId: event.sessionId,
        });
    }
  }, {
    types: ["project.changed", "project.removed", "session.summary", "session.deleted"] as const,
  });

  return <ProjectsContext.Provider value={projects}>{children}</ProjectsContext.Provider>;
}

export function useProjects() {
  const context = useContext(ProjectsContext);

  if (!context) {
    throw new Error("useProjects must be used within a ProjectsProvider.");
  }

  return context;
}

export function useSortedProjects() {
  const projects = useProjects();

  return useMemo(() => sortProjects(Object.values(projects)), [projects]);
}
