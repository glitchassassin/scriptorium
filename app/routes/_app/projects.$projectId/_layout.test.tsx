import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ProjectLayoutRoute from "~/routes/_app/projects.$projectId/_layout";

const navigateMock = vi.fn();
const useSessionEventsMock = vi.fn();

vi.mock("react-router", () => ({
  Outlet: () => <div>Outlet</div>,
  useNavigate: () => navigateMock,
}));

vi.mock("~/lib/auth/guards.server", () => ({
  requireAuthenticatedPasskey: vi.fn(),
}));

vi.mock("~/lib/opencode/shared-runtime.server", () => ({
  getSharedOpencodeRuntimeStatus: vi.fn(),
}));

vi.mock("~/components/events/project-events-provider", () => ({
  ProjectEventsProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("~/components/events/session-events-provider", () => ({
  useSessionEvents: (...args: unknown[]) => useSessionEventsMock(...args),
}));

describe("ProjectLayoutRoute", () => {
  it("navigates back to the project list when the current project is removed", () => {
    let onSessionEvent: ((event: any) => void) | null = null;

    useSessionEventsMock.mockImplementation((handler: (event: any) => void) => {
      onSessionEvent = handler;
    });

    render(<ProjectLayoutRoute {...({
      loaderData: {
        runtime: {
          activeSince: null,
          error: null,
          installedVersion: "1.4.0",
          isRunning: true,
          mode: "managed",
          restartRequired: false,
          runningVersion: "1.4.0",
          serverUrl: "http://127.0.0.1:4100",
        },
      },
      matches: [],
      params: { projectId: "project-1" },
    } as any)} />);

    if (!onSessionEvent) {
      throw new Error("Missing session event handler");
    }

    const sessionEventHandler = onSessionEvent as (event: any) => void;

    sessionEventHandler({ type: "project.removed", projectId: "project-2" });
    expect(navigateMock).not.toHaveBeenCalled();

    sessionEventHandler({ type: "project.removed", projectId: "project-1" });
    expect(navigateMock).toHaveBeenCalledWith("/projects", { replace: true });
  });
});
