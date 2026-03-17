import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "~/components/shell/app-shell";
import { getSessionIconNavActions } from "~/routes/_app/instances.$instanceId/sessions.$sessionId/+/session-route";

const useLocationMock = vi.fn();

vi.mock("react-router", () => ({
  Form: ({ children }: { children: ReactNode }) => <form>{children}</form>,
  NavLink: ({ "aria-label": ariaLabel, children, className, to }: {
    "aria-label"?: string;
    children: ReactNode;
    className?: string | ((args: { isActive: boolean }) => string);
    to: string;
  }) => (
    <a
      aria-label={ariaLabel}
      className={typeof className === "function" ? className({ isActive: false }) : className}
      data-to={to}
      href={to}
    >
      {children}
    </a>
  ),
  Outlet: () => <div>Outlet</div>,
  useLocation: () => useLocationMock(),
}));

vi.mock("~/components/shell/sidebar-nav", () => ({
  SidebarNav: () => <div>Sidebar</div>,
}));

describe("AppShell", () => {
  it("uses the deepest title and nearest nav actions independently", () => {
    useLocationMock.mockReturnValue({ pathname: "/instances/instance-1/sessions/session-1/git" });

    render(
      <AppShell
        breadcrumbs={[
          { label: "Workspace", to: "/instances/instance-1" },
          { label: "Planning", to: "/instances/instance-1/sessions/session-1" },
          { label: "git" },
        ]}
        iconNavActions={getSessionIconNavActions("instance-1", "session-1")}
        sidebarInstances={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Workspace / Planning / git" })).toBeInTheDocument();
    expect(screen.getByLabelText("Chat transcript")).toHaveAttribute(
      "href",
      "/instances/instance-1/sessions/session-1",
    );
    expect(screen.getByLabelText("Git view")).toHaveAttribute(
      "href",
      "/instances/instance-1/sessions/session-1/git",
    );
    expect(screen.queryByLabelText("Instance overview")).not.toBeInTheDocument();
  });
});
