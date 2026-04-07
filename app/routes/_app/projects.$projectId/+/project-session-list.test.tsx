import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { ProjectSessionList } from "~/routes/_app/projects.$projectId/+/project-session-list";

function renderProjectSessionList(sessions: Parameters<typeof ProjectSessionList>[0]["sessions"]) {
  const router = createMemoryRouter(
    [
      {
        path: "/projects/:projectId",
        element: <ProjectSessionList projectId="project-1" sessions={sessions} />,
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
      },
      {
        id: "session-root",
        parentID: null,
        title: "Root session",
        directory: null,
        createdAt: 1,
        updatedAt: 2,
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
  });

  it("shows an empty state when no sessions are available", () => {
    renderProjectSessionList([]);

    expect(screen.getByText("No Opencode sessions were found for this project.")).toBeInTheDocument();
  });
});
