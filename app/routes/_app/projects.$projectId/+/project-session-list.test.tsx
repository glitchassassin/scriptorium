import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { ProjectSessionList } from "~/routes/_app/projects.$projectId/+/project-session-list";
import { SessionsProvider } from "~/store/sessions-provider";

vi.mock("~/components/events/session-events-provider", () => ({
  useSessionEvents: vi.fn(),
}));

function renderProjectSessionList(
  sessions: Parameters<typeof ProjectSessionList>[0]["sessions"],
  initialSessionStatuses: NonNullable<Parameters<typeof ProjectSessionList>[0]["initialSessionStatuses"]> = {},
) {
  const initialSessions = Object.fromEntries(sessions.map((session) => [session.id, session] as const));
  const router = createMemoryRouter(
    [
      {
        path: "/projects/:projectId",
        element: (
          <SessionsProvider initialSessions={initialSessions} initialStatuses={initialSessionStatuses}>
            <ProjectSessionList
              projectId="project-1"
              sessions={sessions}
              initialSessionStatuses={initialSessionStatuses}
            />
          </SessionsProvider>
        ),
      },
    ],
    { initialEntries: ["/projects/project-1"] },
  );

  return render(<RouterProvider router={router} />);
}

describe("ProjectSessionList", () => {
  it("renders child sessions nested under their parent even when newer", () => {
    renderProjectSessionList([
      {
        id: "session-child",
        parentID: "session-root",
        title: "Child session",
        directory: null,
        createdAt: 3,
        updatedAt: 4,
        lastReadAt: null,
      },
      {
        id: "session-root",
        parentID: null,
        title: "Root session",
        directory: null,
        createdAt: 1,
        updatedAt: 2,
        lastReadAt: 2,
      },
    ]);

    const links = screen.getAllByRole("link");

    expect(links.map((link) => link.textContent)).toEqual([
      expect.stringContaining("Root session"),
      expect.stringContaining("Child session"),
    ]);
    expect(screen.getByRole("button", { name: /delete root session/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete child session/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /child session/i })).toHaveAttribute(
      "href",
      "/projects/project-1/sessions/session-child",
    );
    expect(screen.queryByTestId("unread-badge")).toBeNull();
  });

  it("shows an unread bubble on unread parent sessions", () => {
    renderProjectSessionList([
      {
        id: "session-root",
        parentID: null,
        title: "Unread root session",
        directory: null,
        createdAt: 1,
        updatedAt: 2,
        lastReadAt: null,
      },
    ]);

    expect(screen.getByText("Unread root session")).toBeInTheDocument();
    expect(screen.getByTestId("unread-badge")).toBeInTheDocument();
  });

  it("shows a hollow unread bubble for active unread parent sessions", () => {
    renderProjectSessionList([
      {
        id: "session-root",
        parentID: null,
        title: "Busy unread root session",
        directory: null,
        createdAt: 1,
        updatedAt: 2,
        lastReadAt: null,
      },
    ], {
      "session-root": { type: "busy" },
    });

    expect(screen.getByTestId("unread-badge")).toHaveClass("border-2", "border-black", "bg-transparent");
  });

  it("does not show an unread bubble on unread child sessions", () => {
    renderProjectSessionList([
      {
        id: "session-child",
        parentID: "session-root",
        title: "Unread child session",
        directory: null,
        createdAt: 3,
        updatedAt: 4,
        lastReadAt: null,
      },
      {
        id: "session-root",
        parentID: null,
        title: "Read root session",
        directory: null,
        createdAt: 1,
        updatedAt: 2,
        lastReadAt: 2,
      },
    ]);

    expect(screen.getByText("Unread child session")).toBeInTheDocument();
    expect(screen.queryByTestId("unread-badge")).toBeNull();
  });

  it("shows an empty state when no sessions are available", () => {
    renderProjectSessionList([]);

    expect(screen.getByText("No Opencode sessions were found for this project.")).toBeInTheDocument();
  });
});
