import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SidebarProjectItem } from "~/components/shell/sidebar-project-item";

const useSessionMock = vi.fn();
const useSessionSidebarIndicatorMock = vi.fn();

vi.mock("react-router", () => ({
  Form: ({ children }: { children: ReactNode }) => <form>{children}</form>,
  NavLink: ({ children, className, to }: {
    children?: ReactNode | ((args: { isActive: boolean }) => ReactNode);
    className?: string | ((args: { isActive: boolean }) => string);
    to: string;
  }) => {
    const isActive = to === "/projects/project-1/sessions/session-1";

    return (
      <a className={typeof className === "function" ? className({ isActive }) : className} href={to}>
        {typeof children === "function" ? (children as (args: { isActive: boolean }) => ReactNode)({ isActive }) : children}
      </a>
    );
  },
}));

vi.mock("~/store/sessions-provider", () => ({
  useSession: (...args: unknown[]) => useSessionMock(...args),
  useSessionSidebarIndicator: (...args: unknown[]) => useSessionSidebarIndicatorMock(...args),
}));

describe("SidebarProjectItem", () => {
  it("renders a solid indicator for unread idle sessions", () => {
    useSessionMock.mockReturnValue({ id: "session-1", parentID: null, title: "Unread session", directory: null, createdAt: 1, updatedAt: 2, lastReadAt: null });
    useSessionSidebarIndicatorMock.mockReturnValue("solid");

    render(
      <SidebarProjectItem
        project={{
          id: "project-1",
          name: "Alpha",
          sessionIds: ["session-1"],
        }}
      />,
    );

    expect(screen.getByText("Unread session")).toBeInTheDocument();
    expect(screen.getByTestId("unread-badge")).toHaveClass("bg-black");
  });

  it("renders a hollow indicator for unread active sessions", () => {
    useSessionMock.mockReturnValue({ id: "session-1", parentID: null, title: "Active unread session", directory: null, createdAt: 1, updatedAt: 2, lastReadAt: null });
    useSessionSidebarIndicatorMock.mockReturnValue("hollow");

    render(
      <SidebarProjectItem
        project={{
          id: "project-1",
          name: "Alpha",
          sessionIds: ["session-1"],
        }}
      />,
    );

    expect(screen.getByText("Active unread session")).toBeInTheDocument();
    expect(screen.getByTestId("unread-badge")).toHaveClass("border-2", "border-black", "bg-transparent");
  });

  it("keeps the active session label underlined", () => {
    useSessionMock.mockReturnValue({ id: "session-1", parentID: null, title: "Active session", directory: null, createdAt: 1, updatedAt: 2, lastReadAt: 3 });
    useSessionSidebarIndicatorMock.mockReturnValue("none");

    render(
      <SidebarProjectItem
        project={{
          id: "project-1",
          name: "Alpha",
          sessionIds: ["session-1"],
        }}
      />,
    );

    expect(screen.getByText("Active session")).toHaveClass("underline", "underline-offset-4");
  });

  it("omits the unread indicator for read sessions", () => {
    useSessionMock.mockReturnValue({ id: "session-1", parentID: null, title: "Read session", directory: null, createdAt: 1, updatedAt: 2, lastReadAt: 3 });
    useSessionSidebarIndicatorMock.mockReturnValue("none");

    render(
      <SidebarProjectItem
        project={{
          id: "project-1",
          name: "Alpha",
          sessionIds: ["session-1"],
        }}
      />,
    );

    expect(screen.getByText("Read session")).toBeInTheDocument();
    expect(screen.queryByTestId("unread-badge")).toBeNull();
  });
});
