import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

import {
  SessionsProvider,
  getSessionStateId,
  type SessionState,
  useMarkSessionReadOptimistic,
  useSession,
  useSessionSidebarIndicator,
  useUnreadStatusEvents,
  useSessionUnreadStatus,
} from "~/store/sessions-provider";

const useSessionEventsMock = vi.fn();

vi.mock("~/components/events/session-events-provider", () => ({
  useSessionEvents: (...args: unknown[]) => useSessionEventsMock(...args),
}));

function TestConsumer() {
  const unread = useSessionUnreadStatus("session-1");
  const indicator = useSessionSidebarIndicator("session-1");
  const session = useSession(getSessionStateId("session-1"));

  return (
    <div>
      <span data-testid="activity">{String(session?.updatedAt ?? null)}</span>
      <span data-testid="parent">{String(session?.parentID ?? null)}</span>
      <span data-testid="read">{String(session?.lastReadAt ?? null)}</span>
      <span data-testid="unread">{String(unread)}</span>
      <span data-testid="indicator">{indicator}</span>
      <span data-testid="title">{String(session?.title ?? null)}</span>
    </div>
  );
}

function TestUnreadStatusConsumer({
  onEvent,
}: {
  onEvent: (event: { projectId: string; sessionId: string; updatedAt: number }) => void;
}) {
  useUnreadStatusEvents(onEvent, { projectId: "project-1", sessionId: "session-1" });
  return null;
}

function TestMarkReadConsumer() {
  const markReadOptimistic = useMarkSessionReadOptimistic();

  return (
    <button onClick={() => markReadOptimistic("session-1", 7)} type="button">
      Mark read
    </button>
  );
}

const initialSessions: Record<string, SessionState> = {
  "session-1": {
    id: "session-1",
    parentID: null,
    title: "Session",
    directory: null,
    createdAt: 1,
    updatedAt: 2,
    lastReadAt: 2,
  },
};

function renderSessionsProvider(ui: ReactElement, initialStatuses?: Record<string, { type: "idle" | "busy" }>) {
  return render(
    <SessionsProvider initialSessions={initialSessions} initialStatuses={initialStatuses}>
      {ui}
    </SessionsProvider>,
  );
}

describe("SessionsProvider", () => {
  it("derives reactive session state from session events", () => {
    let onSessionEvent: ((event: any) => void) | null = null;

    useSessionEventsMock.mockImplementation((handler: (event: any) => void) => {
      onSessionEvent = handler;
    });

    renderSessionsProvider(<TestConsumer />);

    expect(screen.getByTestId("activity")).toHaveTextContent("2");
    expect(screen.getByTestId("parent")).toHaveTextContent("null");
    expect(screen.getByTestId("read")).toHaveTextContent("2");
    expect(screen.getByTestId("unread")).toHaveTextContent("false");
    expect(screen.getByTestId("indicator")).toHaveTextContent("none");
    expect(screen.getByTestId("title")).toHaveTextContent("Session");

    if (!onSessionEvent) {
      throw new Error("Missing event handler");
    }

    const sessionEventHandler: (event: any) => void = onSessionEvent;

    act(() => {
      sessionEventHandler({
        type: "session.activity",
        projectId: "project-1",
        sessionId: "session-1",
        updatedAt: 503,
      });
    });

    expect(screen.getByTestId("activity")).toHaveTextContent("503");
    expect(screen.getByTestId("parent")).toHaveTextContent("null");
    expect(screen.getByTestId("read")).toHaveTextContent("2");
    expect(screen.getByTestId("unread")).toHaveTextContent("true");
    expect(screen.getByTestId("indicator")).toHaveTextContent("solid");
    expect(screen.getByTestId("title")).toHaveTextContent("Session");

    act(() => {
      sessionEventHandler({
        type: "session.status",
        projectId: "project-1",
        sessionId: "session-1",
        status: { type: "busy" },
      });
    });

    expect(screen.getByTestId("indicator")).toHaveTextContent("hollow");

    act(() => {
      sessionEventHandler({
        type: "session.read",
        sessionId: "session-1",
        lastReadAt: 6,
      });
    });

    expect(screen.getByTestId("activity")).toHaveTextContent("503");
    expect(screen.getByTestId("parent")).toHaveTextContent("null");
    expect(screen.getByTestId("read")).toHaveTextContent("6");
    expect(screen.getByTestId("unread")).toHaveTextContent("false");
    expect(screen.getByTestId("indicator")).toHaveTextContent("none");
    expect(screen.getByTestId("title")).toHaveTextContent("Session");
  });

  it("removes deleted sessions from state", () => {
    let onSessionEvent: ((event: any) => void) | null = null;

    useSessionEventsMock.mockImplementation((handler: (event: any) => void) => {
      onSessionEvent = handler;
    });

    renderSessionsProvider(<TestConsumer />);

    if (!onSessionEvent) {
      throw new Error("Missing session event handler");
    }

    const sessionEventHandler: (event: any) => void = onSessionEvent;

    act(() => {
      sessionEventHandler({
        type: "session.deleted",
        projectId: "project-1",
        sessionId: "session-1",
      });
    });

    expect(screen.getByTestId("activity")).toHaveTextContent("null");
    expect(screen.getByTestId("parent")).toHaveTextContent("null");
    expect(screen.getByTestId("read")).toHaveTextContent("null");
    expect(screen.getByTestId("unread")).toHaveTextContent("false");
    expect(screen.getByTestId("indicator")).toHaveTextContent("none");
  });

  it("publishes unread-status events from project activity", () => {
    let onSessionEvent: ((event: any) => void) | null = null;
    const onUnreadStatusEvent = vi.fn();

    useSessionEventsMock.mockImplementation((handler: (event: any) => void) => {
      onSessionEvent = handler;
    });

    renderSessionsProvider(<TestUnreadStatusConsumer onEvent={onUnreadStatusEvent} />);

    if (!onSessionEvent) {
      throw new Error("Missing session event handler");
    }

    const sessionEventHandler: (event: any) => void = onSessionEvent;

    act(() => {
      sessionEventHandler({
        type: "session.activity",
        projectId: "project-1",
        sessionId: "session-1",
        updatedAt: 5,
      });
    });

    expect(onUnreadStatusEvent).toHaveBeenCalledWith({
      projectId: "project-1",
      sessionId: "session-1",
      updatedAt: 5,
    });
  });

  it("preserves parent session ids from session updates", () => {
    let onSessionEvent: ((event: any) => void) | null = null;

    useSessionEventsMock.mockImplementation((handler: (event: any) => void) => {
      onSessionEvent = handler;
    });

    renderSessionsProvider(<TestConsumer />);

    if (!onSessionEvent) {
      throw new Error("Missing session event handler");
    }

    const sessionEventHandler: (event: any) => void = onSessionEvent;

    act(() => {
      sessionEventHandler({
        type: "session.summary",
        projectId: "project-1",
        summary: {
          id: "session-1",
          parentID: "session-root",
          title: "Session",
          directory: null,
          createdAt: 1,
          updatedAt: 5,
        },
      });
    });

    expect(screen.getByTestId("parent")).toHaveTextContent("session-root");
  });

  it("treats question requests as unread session activity", () => {
    let onSessionEvent: ((event: any) => void) | null = null;

    useSessionEventsMock.mockImplementation((handler: (event: any) => void) => {
      onSessionEvent = handler;
    });

    renderSessionsProvider(<TestConsumer />);

    if (!onSessionEvent) {
      throw new Error("Missing session event handler");
    }

    const sessionEventHandler: (event: any) => void = onSessionEvent;

    act(() => {
      sessionEventHandler({
        type: "session.activity",
        projectId: "project-1",
        sessionId: "session-1",
        updatedAt: 10_000,
      });
    });

    expect(screen.getByTestId("unread")).toHaveTextContent("true");
    expect(screen.getByTestId("indicator")).toHaveTextContent("solid");
  });

  it("keeps newer activity timestamps when older activity arrives later", () => {
    let onSessionEvent: ((event: any) => void) | null = null;

    useSessionEventsMock.mockImplementation((handler: (event: any) => void) => {
      onSessionEvent = handler;
    });

    render(
      <SessionsProvider initialSessions={initialSessions}>
        <TestConsumer />
      </SessionsProvider>,
    );

    if (!onSessionEvent) {
      throw new Error("Missing session event handler");
    }

    const sessionEventHandler: (event: any) => void = onSessionEvent;

    act(() => {
      sessionEventHandler({
        type: "session.activity",
        projectId: "project-1",
        sessionId: "session-1",
        updatedAt: 503,
      });
      sessionEventHandler({
        type: "session.status",
        projectId: "project-1",
        sessionId: "session-1",
        status: { type: "busy" },
      });
      sessionEventHandler({
        type: "session.activity",
        projectId: "project-1",
        sessionId: "session-1",
        updatedAt: 4,
      });
    });

    expect(screen.getByTestId("activity")).toHaveTextContent("503");
    expect(screen.getByTestId("unread")).toHaveTextContent("true");
    expect(screen.getByTestId("indicator")).toHaveTextContent("hollow");

    act(() => {
      sessionEventHandler({
        type: "session.status",
        projectId: "project-1",
        sessionId: "session-1",
        status: { type: "idle" },
      });
    });

    expect(screen.getByTestId("activity")).toHaveTextContent("503");
    expect(screen.getByTestId("unread")).toHaveTextContent("true");
    expect(screen.getByTestId("indicator")).toHaveTextContent("solid");
  });

  it("keeps newer activity timestamps when older summaries arrive later", () => {
    let onSessionEvent: ((event: any) => void) | null = null;

    useSessionEventsMock.mockImplementation((handler: (event: any) => void) => {
      onSessionEvent = handler;
    });

    render(
      <SessionsProvider initialSessions={initialSessions}>
        <TestConsumer />
      </SessionsProvider>,
    );

    if (!onSessionEvent) {
      throw new Error("Missing session event handler");
    }

    const sessionEventHandler: (event: any) => void = onSessionEvent;

    act(() => {
      sessionEventHandler({
        type: "session.activity",
        projectId: "project-1",
        sessionId: "session-1",
        updatedAt: 503,
      });
      sessionEventHandler({
        type: "session.summary",
        projectId: "project-1",
        summary: {
          id: "session-1",
          parentID: null,
          title: "Session",
          directory: null,
          createdAt: 1,
          updatedAt: 4,
        },
      });
    });

    expect(screen.getByTestId("activity")).toHaveTextContent("503");
    expect(screen.getByTestId("unread")).toHaveTextContent("true");
    expect(screen.getByTestId("indicator")).toHaveTextContent("solid");
  });

  it("hydrates sidebar indicators from initial statuses", () => {
    useSessionEventsMock.mockImplementation(() => {});

    render(
      <SessionsProvider
        initialSessions={{
          "session-1": {
            ...initialSessions["session-1"],
            lastReadAt: null,
          },
        }}
        initialStatuses={{
          "session-1": { type: "busy" },
        }}
      >
        <TestConsumer />
      </SessionsProvider>,
    );

    expect(screen.getByTestId("unread")).toHaveTextContent("true");
    expect(screen.getByTestId("indicator")).toHaveTextContent("hollow");
  });

  it("marks sessions read optimistically before SSE confirmation", () => {
    useSessionEventsMock.mockImplementation(() => {});

    renderSessionsProvider(
      <>
        <TestConsumer />
        <TestMarkReadConsumer />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));

    expect(screen.getByTestId("read")).toHaveTextContent("7");
    expect(screen.getByTestId("unread")).toHaveTextContent("false");
    expect(screen.getByTestId("indicator")).toHaveTextContent("none");
  });

  it("keeps the session read for near-simultaneous optimistic read and activity", () => {
    let onSessionEvent: ((event: any) => void) | null = null;

    useSessionEventsMock.mockImplementation((handler: (event: any) => void) => {
      onSessionEvent = handler;
    });

    renderSessionsProvider(
      <>
        <TestConsumer />
        <TestMarkReadConsumer />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));

    if (!onSessionEvent) {
      throw new Error("Missing session event handler");
    }

    const sessionEventHandler: (event: any) => void = onSessionEvent;

    act(() => {
      sessionEventHandler({
        type: "session.activity",
        projectId: "project-1",
        sessionId: "session-1",
        updatedAt: 7 + 500,
      });
    });

    expect(screen.getByTestId("activity")).toHaveTextContent("507");
    expect(screen.getByTestId("read")).toHaveTextContent("7");
    expect(screen.getByTestId("unread")).toHaveTextContent("false");
    expect(screen.getByTestId("indicator")).toHaveTextContent("none");

    act(() => {
      sessionEventHandler({
        type: "session.activity",
        projectId: "project-1",
        sessionId: "session-1",
        updatedAt: 7 + 501,
      });
    });

    expect(screen.getByTestId("activity")).toHaveTextContent("508");
    expect(screen.getByTestId("read")).toHaveTextContent("7");
    expect(screen.getByTestId("unread")).toHaveTextContent("true");
    expect(screen.getByTestId("indicator")).toHaveTextContent("solid");
  });

  it("preserves live statuses when loader revalidation brings older status snapshots", () => {
    let onSessionEvent: ((event: any) => void) | null = null;

    useSessionEventsMock.mockImplementation((handler: (event: any) => void) => {
      onSessionEvent = handler;
    });

    const view = render(
      <SessionsProvider
        initialSessions={{
          "session-1": {
            ...initialSessions["session-1"],
            lastReadAt: null,
            updatedAt: 503,
          },
        }}
        initialStatuses={{
          "session-1": { type: "idle" },
        }}
      >
        <TestConsumer />
      </SessionsProvider>,
    );

    if (!onSessionEvent) {
      throw new Error("Missing session event handler");
    }

    const sessionEventHandler: (event: any) => void = onSessionEvent;

    act(() => {
      sessionEventHandler({
        type: "session.status",
        projectId: "project-1",
        sessionId: "session-1",
        status: { type: "busy" },
      });
    });

    expect(screen.getByTestId("indicator")).toHaveTextContent("hollow");

    view.rerender(
      <SessionsProvider
        initialSessions={{
          "session-1": {
            ...initialSessions["session-1"],
            lastReadAt: null,
            updatedAt: 503,
          },
        }}
        initialStatuses={{
          "session-1": { type: "idle" },
        }}
      >
        <TestConsumer />
      </SessionsProvider>,
    );

    expect(screen.getByTestId("indicator")).toHaveTextContent("hollow");
  });
});
