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

const useInstanceEventsMock = vi.fn();
const useReadStatusEventsMock = vi.fn();

vi.mock("~/components/events/instance-events-provider", () => ({
  useInstanceEvents: (...args: unknown[]) => useInstanceEventsMock(...args),
}));

vi.mock("~/components/events/read-status-events-provider", () => ({
  useReadStatusEvents: (...args: unknown[]) => useReadStatusEventsMock(...args),
}));

function TestConsumer() {
  const unread = useSessionUnreadStatus("session-1");
  const session = useSession(getSessionStateId("session-1"));

  return (
    <div>
      <span data-testid="activity">{String(session?.updatedAt ?? null)}</span>
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
    title: "Session",
    directory: null,
    createdAt: 1,
    updatedAt: 2,
    lastReadAt: 2,
  },
};

describe("SessionsProvider", () => {
  it("derives reactive session state from instance and read events", () => {
    let onInstanceEvent: ((event: any) => void) | null = null;
    let onReadStatusEvent: ((event: any) => void) | null = null;

    useInstanceEventsMock.mockImplementation((handler: (event: any) => void) => {
      onInstanceEvent = handler;
    });
    useReadStatusEventsMock.mockImplementation((handler: (event: any) => void) => {
      onReadStatusEvent = handler;
    });

    render(
      <SessionsProvider initialSessions={initialSessions}>
        <TestConsumer />
      </SessionsProvider>,
    );

    expect(screen.getByTestId("activity")).toHaveTextContent("2");
    expect(screen.getByTestId("read")).toHaveTextContent("2");
    expect(screen.getByTestId("unread")).toHaveTextContent("false");
    expect(screen.getByTestId("title")).toHaveTextContent("Session");

    if (!onInstanceEvent || !onReadStatusEvent) {
      throw new Error("Missing event handlers");
    }

    const instanceEventHandler: (event: any) => void = onInstanceEvent;
    const readStatusEventHandler: (event: any) => void = onReadStatusEvent;

    act(() => {
      instanceEventHandler({
        type: "message.updated",
        instanceId: "instance-1",
        properties: {
          info: {
            sessionID: "session-1",
            time: { created: 503 },
          },
        },
      });
    });

    expect(screen.getByTestId("activity")).toHaveTextContent("503");
    expect(screen.getByTestId("read")).toHaveTextContent("2");
    expect(screen.getByTestId("unread")).toHaveTextContent("true");
    expect(screen.getByTestId("title")).toHaveTextContent("Session");

    act(() => {
      readStatusEventHandler({
        type: "session.read",
        sessionId: "session-1",
        lastReadAt: 6,
      });
    });

    expect(screen.getByTestId("activity")).toHaveTextContent("503");
    expect(screen.getByTestId("read")).toHaveTextContent("6");
    expect(screen.getByTestId("unread")).toHaveTextContent("false");
    expect(screen.getByTestId("title")).toHaveTextContent("Session");
  });

  it("removes deleted sessions from state", () => {
    let onInstanceEvent: ((event: any) => void) | null = null;

    useInstanceEventsMock.mockImplementation((handler: (event: any) => void) => {
      onInstanceEvent = handler;
    });
    useReadStatusEventsMock.mockImplementation(() => {});

    render(
      <SessionsProvider initialSessions={initialSessions}>
        <TestConsumer />
      </SessionsProvider>,
    );

    if (!onInstanceEvent) {
      throw new Error("Missing instance event handler");
    }

    const instanceEventHandler: (event: any) => void = onInstanceEvent;

    act(() => {
      instanceEventHandler({
        type: "session.deleted",
        instanceId: "instance-1",
        properties: {
          info: {
            id: "session-1",
          },
        },
      });
    });

    expect(screen.getByTestId("activity")).toHaveTextContent("null");
    expect(screen.getByTestId("read")).toHaveTextContent("null");
    expect(screen.getByTestId("unread")).toHaveTextContent("false");
  });

  it("publishes unread-status events from instance activity", () => {
    let onInstanceEvent: ((event: any) => void) | null = null;
    const onUnreadStatusEvent = vi.fn();

    useInstanceEventsMock.mockImplementation((handler: (event: any) => void) => {
      onInstanceEvent = handler;
    });
    useReadStatusEventsMock.mockImplementation(() => {});

    render(
      <SessionsProvider initialSessions={initialSessions}>
        <TestUnreadStatusConsumer onEvent={onUnreadStatusEvent} />
      </SessionsProvider>,
    );

    if (!onInstanceEvent) {
      throw new Error("Missing instance event handler");
    }

    const instanceEventHandler: (event: any) => void = onInstanceEvent;

    act(() => {
      instanceEventHandler({
        type: "message.updated",
        instanceId: "instance-1",
        properties: {
          info: {
            sessionID: "session-1",
            time: { created: 5 },
          },
        },
      });
    });

    expect(onUnreadStatusEvent).toHaveBeenCalledWith({
      instanceId: "instance-1",
      sessionId: "session-1",
      updatedAt: 5,
    });
  });

  it("treats question requests as unread session activity", () => {
    let onInstanceEvent: ((event: any) => void) | null = null;

    useInstanceEventsMock.mockImplementation((handler: (event: any) => void) => {
      onInstanceEvent = handler;
    });
    useReadStatusEventsMock.mockImplementation(() => {});

    render(
      <SessionsProvider initialSessions={initialSessions}>
        <TestConsumer />
      </SessionsProvider>,
    );

    if (!onInstanceEvent) {
      throw new Error("Missing instance event handler");
    }

    const instanceEventHandler: (event: any) => void = onInstanceEvent;

    act(() => {
      instanceEventHandler({
        type: "question.asked",
        instanceId: "instance-1",
        properties: {
          id: "question-1",
          sessionID: "session-1",
          questions: [
            {
              question: "What next?",
              header: "Next",
              options: [{ label: "Tests", description: "Run tests" }],
            },
          ],
        },
      });
    });

    expect(screen.getByTestId("unread")).toHaveTextContent("true");
  });

  it("marks sessions read optimistically before SSE confirmation", () => {
    useInstanceEventsMock.mockImplementation(() => {});
    useReadStatusEventsMock.mockImplementation(() => {});

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
    let onInstanceEvent: ((event: any) => void) | null = null;

    useInstanceEventsMock.mockImplementation((handler: (event: any) => void) => {
      onInstanceEvent = handler;
    });
    useReadStatusEventsMock.mockImplementation(() => {});

    render(
      <SessionsProvider initialSessions={initialSessions}>
        <TestConsumer />
        <TestMarkReadConsumer />
      </SessionsProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));

    if (!onInstanceEvent) {
      throw new Error("Missing instance event handler");
    }

    const instanceEventHandler: (event: any) => void = onInstanceEvent;

    act(() => {
      instanceEventHandler({
        type: "message.updated",
        instanceId: "instance-1",
        properties: {
          info: {
            sessionID: "session-1",
            time: { created: 7 + 500 },
          },
        },
      });
    });

    expect(screen.getByTestId("activity")).toHaveTextContent("507");
    expect(screen.getByTestId("read")).toHaveTextContent("7");
    expect(screen.getByTestId("unread")).toHaveTextContent("false");

    act(() => {
      instanceEventHandler({
        type: "message.updated",
        instanceId: "instance-1",
        properties: {
          info: {
            sessionID: "session-1",
            time: { created: 7 + 501 },
          },
        },
      });
    });

    expect(screen.getByTestId("activity")).toHaveTextContent("508");
    expect(screen.getByTestId("read")).toHaveTextContent("7");
    expect(screen.getByTestId("unread")).toHaveTextContent("true");
  });
});
