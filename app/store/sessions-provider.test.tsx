import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  SessionsProvider,
  getSessionStateId,
  type SessionState,
  useMarkSessionReadOptimistic,
  useSession,
  useUnreadStatusEvents,
  useSessionUnreadStatus,
} from "~/store/sessions-provider";

const useSessionEventsMock = vi.fn();

vi.mock("~/components/events/session-events-provider", () => ({
  useSessionEvents: (...args: unknown[]) => useSessionEventsMock(...args),
}));

function TestConsumer() {
  const unread = useSessionUnreadStatus("session-1");
  const session = useSession(getSessionStateId("session-1"));

  return (
    <div>
      <span data-testid="activity">{String(session?.updatedAt ?? null)}</span>
      <span data-testid="parent">{String(session?.parentID ?? null)}</span>
      <span data-testid="read">{String(session?.lastReadAt ?? null)}</span>
      <span data-testid="unread">{String(unread)}</span>
      <span data-testid="title">{String(session?.title ?? null)}</span>
    </div>
  );
}

function TestUnreadStatusConsumer({
  onEvent,
}: {
  onEvent: (event: { instanceId: string; sessionId: string; updatedAt: number }) => void;
}) {
  useUnreadStatusEvents(onEvent, { instanceId: "instance-1", sessionId: "session-1" });
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

describe("SessionsProvider", () => {
  it("derives reactive session state from session events", () => {
    let onSessionEvent: ((event: any) => void) | null = null;

    useSessionEventsMock.mockImplementation((handler: (event: any) => void) => {
      onSessionEvent = handler;
    });

    render(
      <SessionsProvider initialSessions={initialSessions}>
        <TestConsumer />
      </SessionsProvider>,
    );

    expect(screen.getByTestId("activity")).toHaveTextContent("2");
    expect(screen.getByTestId("parent")).toHaveTextContent("null");
    expect(screen.getByTestId("read")).toHaveTextContent("2");
    expect(screen.getByTestId("unread")).toHaveTextContent("false");
    expect(screen.getByTestId("title")).toHaveTextContent("Session");

    if (!onSessionEvent) {
      throw new Error("Missing event handler");
    }

    const sessionEventHandler: (event: any) => void = onSessionEvent;

    act(() => {
      sessionEventHandler({
        type: "session.activity",
        instanceId: "instance-1",
        sessionId: "session-1",
        updatedAt: 503,
      });
    });

    expect(screen.getByTestId("activity")).toHaveTextContent("503");
    expect(screen.getByTestId("parent")).toHaveTextContent("null");
    expect(screen.getByTestId("read")).toHaveTextContent("2");
    expect(screen.getByTestId("unread")).toHaveTextContent("true");
    expect(screen.getByTestId("title")).toHaveTextContent("Session");

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
    expect(screen.getByTestId("title")).toHaveTextContent("Session");
  });

  it("removes deleted sessions from state", () => {
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
        type: "session.deleted",
        instanceId: "instance-1",
        sessionId: "session-1",
      });
    });

    expect(screen.getByTestId("activity")).toHaveTextContent("null");
    expect(screen.getByTestId("parent")).toHaveTextContent("null");
    expect(screen.getByTestId("read")).toHaveTextContent("null");
    expect(screen.getByTestId("unread")).toHaveTextContent("false");
  });

  it("publishes unread-status events from instance activity", () => {
    let onSessionEvent: ((event: any) => void) | null = null;
    const onUnreadStatusEvent = vi.fn();

    useSessionEventsMock.mockImplementation((handler: (event: any) => void) => {
      onSessionEvent = handler;
    });

    render(
      <SessionsProvider initialSessions={initialSessions}>
        <TestUnreadStatusConsumer onEvent={onUnreadStatusEvent} />
      </SessionsProvider>,
    );

    if (!onSessionEvent) {
      throw new Error("Missing session event handler");
    }

    const sessionEventHandler: (event: any) => void = onSessionEvent;

    act(() => {
      sessionEventHandler({
        type: "session.activity",
        instanceId: "instance-1",
        sessionId: "session-1",
        updatedAt: 5,
      });
    });

    expect(onUnreadStatusEvent).toHaveBeenCalledWith({
      instanceId: "instance-1",
      sessionId: "session-1",
      updatedAt: 5,
    });
  });

  it("preserves parent session ids from session updates", () => {
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
        type: "session.summary",
        instanceId: "instance-1",
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
        instanceId: "instance-1",
        sessionId: "session-1",
        updatedAt: 10_000,
      });
    });

    expect(screen.getByTestId("unread")).toHaveTextContent("true");
  });

  it("marks sessions read optimistically before SSE confirmation", () => {
    useSessionEventsMock.mockImplementation(() => {});

    render(
      <SessionsProvider initialSessions={initialSessions}>
        <TestConsumer />
        <TestMarkReadConsumer />
      </SessionsProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));

    expect(screen.getByTestId("read")).toHaveTextContent("7");
    expect(screen.getByTestId("unread")).toHaveTextContent("false");
  });

  it("keeps the session read for near-simultaneous optimistic read and activity", () => {
    let onSessionEvent: ((event: any) => void) | null = null;

    useSessionEventsMock.mockImplementation((handler: (event: any) => void) => {
      onSessionEvent = handler;
    });

    render(
      <SessionsProvider initialSessions={initialSessions}>
        <TestConsumer />
        <TestMarkReadConsumer />
      </SessionsProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));

    if (!onSessionEvent) {
      throw new Error("Missing session event handler");
    }

    const sessionEventHandler: (event: any) => void = onSessionEvent;

    act(() => {
      sessionEventHandler({
        type: "session.activity",
        instanceId: "instance-1",
        sessionId: "session-1",
        updatedAt: 7 + 500,
      });
    });

    expect(screen.getByTestId("activity")).toHaveTextContent("507");
    expect(screen.getByTestId("read")).toHaveTextContent("7");
    expect(screen.getByTestId("unread")).toHaveTextContent("false");

    act(() => {
      sessionEventHandler({
        type: "session.activity",
        instanceId: "instance-1",
        sessionId: "session-1",
        updatedAt: 7 + 501,
      });
    });

    expect(screen.getByTestId("activity")).toHaveTextContent("508");
    expect(screen.getByTestId("read")).toHaveTextContent("7");
    expect(screen.getByTestId("unread")).toHaveTextContent("true");
  });
});
