import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SidebarInstanceItem } from "~/components/shell/sidebar-instance-item";

const useSessionMock = vi.fn();
const useSessionUnreadStatusMock = vi.fn();

vi.mock("react-router", () => ({
  Form: ({ children }: { children: ReactNode }) => <form>{children}</form>,
  NavLink: ({ children, className, to }: {
    children?: ReactNode | ((args: { isActive: boolean }) => ReactNode);
    className?: string | ((args: { isActive: boolean }) => string);
    to: string;
  }) => {
    const isActive = to === "/instances/instance-1/sessions/session-1";

    return (
      <a className={typeof className === "function" ? className({ isActive }) : className} href={to}>
        {typeof children === "function" ? (children as (args: { isActive: boolean }) => ReactNode)({ isActive }) : children}
      </a>
    );
  },
}));

vi.mock("~/store/sessions-provider", () => ({
  useSession: (...args: unknown[]) => useSessionMock(...args),
  useSessionUnreadStatus: (...args: unknown[]) => useSessionUnreadStatusMock(...args),
}));

describe("SidebarInstanceItem", () => {
  it("renders an unread indicator for unread sessions", () => {
    useSessionMock.mockReturnValue({ id: "session-1", parentID: null, title: "Unread session", directory: null, createdAt: 1, updatedAt: 2, lastReadAt: null });
    useSessionUnreadStatusMock.mockReturnValue(true);

    render(
      <SidebarInstanceItem
        instance={{
          id: "instance-1",
          name: "Alpha",
          status: "running",
          sessionIds: ["session-1"],
        }}
      />,
    );

    expect(screen.getByText("Unread session")).toBeInTheDocument();
    expect(screen.getByTestId("unread-badge")).toBeInTheDocument();
  });

  it("keeps the active session label underlined", () => {
    useSessionMock.mockReturnValue({ id: "session-1", parentID: null, title: "Active session", directory: null, createdAt: 1, updatedAt: 2, lastReadAt: 3 });
    useSessionUnreadStatusMock.mockReturnValue(false);

    render(
      <SidebarInstanceItem
        instance={{
          id: "instance-1",
          name: "Alpha",
          status: "running",
          sessionIds: ["session-1"],
        }}
      />,
    );

    expect(screen.getByText("Active session")).toHaveClass("underline", "underline-offset-4");
  });

  it("omits the unread indicator for read sessions", () => {
    useSessionMock.mockReturnValue({ id: "session-1", parentID: null, title: "Read session", directory: null, createdAt: 1, updatedAt: 2, lastReadAt: 3 });
    useSessionUnreadStatusMock.mockReturnValue(false);

    render(
      <SidebarInstanceItem
        instance={{
          id: "instance-1",
          name: "Alpha",
          status: "running",
          sessionIds: ["session-1"],
        }}
      />,
    );

    expect(screen.getByText("Read session")).toBeInTheDocument();
    expect(screen.queryByTestId("unread-badge")).toBeNull();
  });
});
