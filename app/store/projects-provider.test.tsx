import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ProjectsProvider,
  getInitialProjects,
} from "~/store/projects-provider";
import {
  useHasVisibleUnreadProjectSessions,
  useVisibleSidebarProjects,
} from "~/components/shell/sidebar-state";
import { SessionsProvider, type SessionState } from "~/store/sessions-provider";

const useSessionEventsMock = vi.fn();

vi.mock("~/components/events/session-events-provider", () => ({
  useSessionEvents: (...args: unknown[]) => useSessionEventsMock(...args),
}));

function TestConsumer() {
  const projects = useVisibleSidebarProjects();
  const hasVisibleUnread = useHasVisibleUnreadProjectSessions();

  return (
    <div>
      <span data-testid="project-count">{String(projects.length)}</span>
      <span data-testid="session-ids">{projects.flatMap((project) => project.sessionIds).join(",")}</span>
      <span data-testid="has-unread">{String(hasVisibleUnread)}</span>
    </div>
  );
}

describe("ProjectsProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-18T00:00:00Z"));
    useSessionEventsMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("derives visible projects from sessions and session events", () => {
    const sessionEventHandlers: Array<(event: any) => void> = [];

    useSessionEventsMock.mockImplementation((handler: (event: any) => void) => {
      sessionEventHandlers.push(handler);
    });

      const initialSessions: Record<string, SessionState> = {
        "session-1": {
          id: "session-1",
          parentID: null,
          title: "Session 1",
          directory: null,
          createdAt: Date.now() - 2_000,
          updatedAt: Date.now() - 1_000,
          lastReadAt: null,
        },
      };

    render(
      <SessionsProvider initialSessions={initialSessions}>
        <ProjectsProvider
          initialProjects={getInitialProjects([
            {
              id: "project-1",
              name: "Alpha",
              recentSessions: [initialSessions["session-1"]],
            },
          ])}
        >
          <TestConsumer />
        </ProjectsProvider>
      </SessionsProvider>,
    );

    expect(screen.getByTestId("project-count")).toHaveTextContent("1");
    expect(screen.getByTestId("session-ids")).toHaveTextContent("session-1");
    expect(screen.getByTestId("has-unread")).toHaveTextContent("true");

    if (!sessionEventHandlers.length) {
      throw new Error("Missing session event handler");
    }

    act(() => {
      for (const sessionEventHandler of sessionEventHandlers) {
        sessionEventHandler({
          type: "session.summary",
          projectId: "project-1",
          summary: {
            id: "session-2",
            parentID: null,
            title: "Session 2",
            directory: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        });
      }
    });

    expect(screen.getByTestId("session-ids")).toHaveTextContent("session-2,session-1");

    act(() => {
      for (const sessionEventHandler of sessionEventHandlers) {
        sessionEventHandler({
          type: "session.summary",
          projectId: "project-1",
          summary: {
            id: "session-2-child",
            parentID: "session-2",
            title: "Session 2 child",
            directory: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        });
      }
    });

    expect(screen.getByTestId("session-ids")).toHaveTextContent("session-2,session-1");

    act(() => {
      for (const sessionEventHandler of sessionEventHandlers) {
        sessionEventHandler({
          type: "session.deleted",
          projectId: "project-1",
          sessionId: "session-1",
        });
      }
    });

    expect(screen.getByTestId("session-ids")).toHaveTextContent("session-2");
  });
});
