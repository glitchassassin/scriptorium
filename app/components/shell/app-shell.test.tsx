import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "~/components/shell/app-shell";
import { getSessionIconNavActions } from "~/routes/_app/projects.$projectId/sessions.$sessionId/+/session-route";

const useLocationMock = vi.fn();
const useHasVisibleUnreadProjectSessionsMock = vi.fn();

vi.mock("react-router", () => ({
  Form: ({ action, children, method }: { action?: string; children: ReactNode; method?: string }) => (
    <form action={action} method={method}>
      {children}
    </form>
  ),
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

vi.mock("~/components/shell/sidebar-state", () => ({
  useHasVisibleUnreadProjectSessions: (...args: unknown[]) => useHasVisibleUnreadProjectSessionsMock(...args),
}));

describe("AppShell", () => {
  it("uses the deepest title and nearest nav actions independently", () => {
    useLocationMock.mockReturnValue({ pathname: "/projects/project-1/sessions/session-1/review/uncommitted" });
    useHasVisibleUnreadProjectSessionsMock.mockReturnValue(false);

    render(
        <AppShell
          breadcrumbs={[
            { content: "Workspace", to: "/projects/project-1" },
            { content: "Planning", to: "/projects/project-1/sessions/session-1" },
            { content: "review" },
          ]}
          leadingIconAction={{
            icon: "mdi:message-plus-outline",
            label: "New session",
            action: "/projects/project-1?index",
            method: "post",
            fields: { intent: "create-session" },
          }}
          iconNavActions={getSessionIconNavActions("project-1", "session-1")}
        />,
      );

    expect(screen.getByRole("heading", { name: "Workspace / Planning / review" })).toBeInTheDocument();
    expect(screen.getByLabelText("Chat transcript")).toHaveAttribute(
      "href",
      "/projects/project-1/sessions/session-1",
    );
    expect(screen.getByLabelText("Review")).toHaveAttribute(
      "href",
      "/projects/project-1/sessions/session-1/review/uncommitted",
    );
    expect(screen.getByRole("button", { name: "New session" }).closest("form")).toHaveAttribute(
      "action",
      "/projects/project-1?index",
    );
    expect(screen.queryByLabelText("Instance overview")).not.toBeInTheDocument();
  });

  it("renders submit-style icon actions as forms with hidden fields", () => {
    useLocationMock.mockReturnValue({ pathname: "/projects/project-1" });
    useHasVisibleUnreadProjectSessionsMock.mockReturnValue(false);

    render(
      <AppShell
        breadcrumbs={[{ content: "Workspace" }]}
        leadingIconAction={undefined}
        iconNavActions={[{
          icon: "mdi:message-plus-outline",
          label: "New session",
          action: "/projects/project-1?index",
          method: "post",
          fields: { intent: "create-session" },
        }]}
      />,
    );

    const button = screen.getByRole("button", { name: "New session" });
    const form = button.closest("form");

    expect(form).toHaveAttribute("action", "/projects/project-1?index");
    expect(form).toHaveAttribute("method", "post");
    expect(screen.getByDisplayValue("create-session")).toHaveAttribute("name", "intent");
  });

  it("shows an unread indicator on the navigation toggle when any sidebar session is unread", () => {
    useLocationMock.mockReturnValue({ pathname: "/projects/project-1" });
    useHasVisibleUnreadProjectSessionsMock.mockReturnValue(true);

    render(
      <AppShell
        breadcrumbs={[{ content: "Workspace" }]}
        leadingIconAction={undefined}
        iconNavActions={[]}
      />,
    );

    expect(screen.getByRole("button", { name: "Toggle navigation" }).querySelector('[data-testid="unread-badge"]')).not.toBeNull();
  });

  it("ignores unread sessions outside the visible sidebar limit", () => {
    useLocationMock.mockReturnValue({ pathname: "/projects/project-1" });
    useHasVisibleUnreadProjectSessionsMock.mockReturnValue(false);

    render(
      <AppShell
        breadcrumbs={[{ content: "Workspace" }]}
        leadingIconAction={undefined}
        iconNavActions={[]}
      />,
    );

    expect(screen.getByRole("button", { name: "Toggle navigation" }).querySelector('[data-testid="unread-badge"]')).toBeNull();
  });
});
