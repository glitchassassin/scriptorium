import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { ProjectSessionList } from "~/routes/_app/projects.$projectId/+/project-session-list";

describe("ProjectSessionList", () => {
  it("renders child sessions nested under their parent even when newer", () => {
    render(
      <MemoryRouter>
        <ProjectSessionList
          projectId="project-1"
          sessions={[
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
          ]}
        />
      </MemoryRouter>,
    );

    const links = screen.getAllByRole("link");

    expect(links.map((link) => link.textContent)).toEqual([
      expect.stringContaining("Root session"),
      expect.stringContaining("Child session"),
    ]);
    expect(screen.getByRole("link", { name: /child session/i })).toHaveAttribute(
      "href",
        "/projects/project-1/sessions/session-child",
    );
  });

  it("shows an empty state when no sessions are available", () => {
    render(
      <MemoryRouter>
        <ProjectSessionList projectId="project-1" sessions={[]} />
      </MemoryRouter>,
    );

    expect(screen.getByText("No Opencode sessions were found for this project.")).toBeInTheDocument();
  });
});
