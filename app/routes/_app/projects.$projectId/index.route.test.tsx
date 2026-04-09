import type { ComponentProps, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useFetcherMock = vi.fn();

vi.mock("react-router", () => ({
  Form: ({ children, method }: { children: ReactNode; method?: string }) => <form method={method}>{children}</form>,
  data: vi.fn(),
  redirect: vi.fn(),
  useFetcher: () => useFetcherMock(),
}));

vi.mock("@iconify/react", () => ({
  Icon: () => null,
}));

vi.mock("@iconify-json/mdi", () => ({}));

vi.mock("~/components/events/project-events-provider", () => ({
  useProjectEvents: vi.fn(),
}));

vi.mock("~/components/opencode/opencode-stopped-state", () => ({
  OpencodeStoppedState: () => <div>Stopped</div>,
}));

vi.mock("~/components/shell/breadcrumbs", () => ({
  Breadcrumbs: Object.assign(({ children }: { children: ReactNode }) => <div>{children}</div>, {
    Item: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  }),
}));

vi.mock("~/components/shell/scrollable-layout", () => ({
  ScrollableLayout: ({ children, header }: { children: ReactNode; header?: ReactNode }) => (
    <div>
      <div>{header}</div>
      {children}
    </div>
  ),
}));

vi.mock("~/lib/auth/guards.server", () => ({
  requireAuthenticatedPasskey: vi.fn(),
}));

vi.mock("~/lib/opencode/shared-runtime.server", () => ({
  getSharedOpencodeRuntimeStatus: vi.fn(),
  startSharedOpencodeServer: vi.fn(),
}));

vi.mock("~/lib/projects/git.server", () => ({
  getGitStatusSummary: vi.fn(),
}));

vi.mock("~/lib/projects/opencode.server", () => ({
  createOpencodeSession: vi.fn(),
  getOpencodeSessionStatuses: vi.fn(),
  listOpencodeQuestionRequests: vi.fn(),
  listOpencodeSessions: vi.fn(),
  removeOpencodeSession: vi.fn(),
}));

vi.mock("~/lib/projects/runtime.server", () => ({
  getProjectOrThrow: vi.fn(),
}));

vi.mock("~/lib/server-timing.server", () => ({
  getServerTimingHeaders: vi.fn(),
  makeTimings: vi.fn(),
  time: vi.fn(),
}));

vi.mock("~/lib/session-read-status.server", () => ({
  listSessionReadStatuses: vi.fn(),
  markSessionRead: vi.fn(),
}));

vi.mock("~/routes/_app/projects.$projectId/+/project-session-list", () => ({
  ProjectSessionList: () => <div>Session list</div>,
}));

vi.mock("~/store/sessions-provider", () => ({
  useHydrateSessionState: vi.fn(),
  useSessions: () => ({}),
}));

import ProjectDetailRoute from "~/routes/_app/projects.$projectId/index";

describe("ProjectDetailRoute", () => {
  beforeEach(() => {
    useFetcherMock.mockReset();
    useFetcherMock.mockReturnValue({
      Form: ({ children, method }: { children: ReactNode; method?: string }) => <form method={method}>{children}</form>,
      state: "idle",
    });
  });

  it("renders the recent sessions title once", () => {
    const props = {
      loaderData: {
        git: {
          ahead: 0,
          behind: 0,
          branch: "main",
          isRepository: true,
          modified: 0,
          staged: 0,
          untracked: 0,
        },
        opencode: {
          isRunning: true,
          mode: "managed",
        },
        project: {
          directory: "/tmp/alpha",
          id: "project-1",
          name: "Alpha",
        },
        recentSessions: [],
        recentSessionStatuses: {},
        sessionError: null,
      },
      matches: [],
    } as unknown as ComponentProps<typeof ProjectDetailRoute>;

    render(<ProjectDetailRoute {...props} />);

    expect(screen.getAllByText("Recent sessions")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "New session" })).toBeInTheDocument();
  });
});
