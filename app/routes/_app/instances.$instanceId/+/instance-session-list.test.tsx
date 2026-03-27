import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { InstanceSessionList } from "~/routes/_app/instances.$instanceId/+/instance-session-list";

describe("InstanceSessionList", () => {
  it("renders child sessions nested under their parent even when newer", () => {
    render(
      <MemoryRouter>
        <InstanceSessionList
          instanceId="instance-1"
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
      "/instances/instance-1/sessions/session-child",
    );
  });

  it("shows an empty state when no sessions are available", () => {
    render(
      <MemoryRouter>
        <InstanceSessionList instanceId="instance-1" sessions={[]} />
      </MemoryRouter>,
    );

    expect(screen.getByText("No Opencode sessions were found for this instance.")).toBeInTheDocument();
  });
});
