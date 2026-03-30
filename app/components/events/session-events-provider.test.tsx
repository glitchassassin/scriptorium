import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidateOnReconnect = vi.fn();

vi.mock("~/components/events/use-coalesced-revalidation", () => ({
  useCoalescedRevalidation: () => revalidateOnReconnect,
}));

import {
  SessionEventsProvider,
  useSessionEvents,
  type SessionEvent,
} from "~/components/events/session-events-provider";
import { RECONNECT_DELAYS_MS } from "~/lib/events/persistent-event-source";

class MockEventSource {
  static instances = new Map<string, MockEventSource[]>();

  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readonly close = vi.fn();

  constructor(public readonly url: string) {
    const instances = MockEventSource.instances.get(url) ?? [];
    instances.push(this);
    MockEventSource.instances.set(url, instances);
  }

  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent<string>);
  }

  emitRaw(data: string) {
    this.onmessage?.({ data } as MessageEvent<string>);
  }

  open() {
    this.onopen?.();
  }

  fail() {
    this.onerror?.();
  }

  static reset() {
    MockEventSource.instances.clear();
  }

  static latest(url: string) {
    return MockEventSource.instances.get(url)?.at(-1);
  }
}

function TestSubscriber({
  filter,
  onEvent,
}: {
  filter?: { sessionId?: string };
  onEvent: (event: SessionEvent) => void;
}) {
  useSessionEvents(onEvent, filter);
  return null;
}

function emitSessionEvent(payload: unknown) {
  const source = MockEventSource.latest("/session-events/events");

  if (!source) {
    throw new Error("Missing mock EventSource for session events.");
  }

  act(() => {
    source.emit(payload);
  });
}

describe("useSessionEvents", () => {
  const originalEventSource = globalThis.EventSource;

  beforeEach(() => {
    MockEventSource.reset();
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
    vi.useFakeTimers();
  });

  afterEach(() => {
    MockEventSource.reset();
    globalThis.EventSource = originalEventSource;
    vi.useRealTimers();
    vi.restoreAllMocks();
    revalidateOnReconnect.mockReset();
  });

  it("delivers parsed events to subscribers", () => {
    const onEvent = vi.fn<(event: SessionEvent) => void>();

    render(
      <SessionEventsProvider>
        <TestSubscriber onEvent={onEvent} />
      </SessionEventsProvider>,
    );

    emitSessionEvent({
      type: "session.read",
      sessionId: "session-1",
      lastReadAt: 6,
    });

    expect(onEvent).toHaveBeenCalledWith({
      type: "session.read",
      sessionId: "session-1",
      lastReadAt: 6,
    });
  });

  it("filters by session", () => {
    const onEvent = vi.fn<(event: SessionEvent) => void>();

    render(
      <SessionEventsProvider>
        <TestSubscriber filter={{ sessionId: "session-1" }} onEvent={onEvent} />
      </SessionEventsProvider>,
    );

    emitSessionEvent({
      type: "session.activity",
      instanceId: "instance-1",
      sessionId: "session-2",
      updatedAt: 5,
    });

    emitSessionEvent({
      type: "session.summary",
      instanceId: "instance-1",
      summary: {
        id: "session-1",
        parentID: null,
        title: "Session 1",
        directory: null,
        createdAt: 4,
        updatedAt: 6,
      },
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      type: "session.summary",
      instanceId: "instance-1",
      summary: {
        id: "session-1",
        parentID: null,
        title: "Session 1",
        directory: null,
        createdAt: 4,
        updatedAt: 6,
      },
    });
  });

  it("matches session status events against the session filter", () => {
    const onEvent = vi.fn<(event: SessionEvent) => void>();

    render(
      <SessionEventsProvider>
        <TestSubscriber filter={{ sessionId: "session-1" }} onEvent={onEvent} />
      </SessionEventsProvider>,
    );

    emitSessionEvent({
      type: "session.status",
      instanceId: "instance-1",
      sessionId: "session-2",
      status: { type: "busy" },
    });

    emitSessionEvent({
      type: "session.status",
      instanceId: "instance-1",
      sessionId: "session-1",
      status: { type: "idle" },
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      type: "session.status",
      instanceId: "instance-1",
      sessionId: "session-1",
      status: { type: "idle" },
    });
  });

  it("logs invalid payloads and closes the source on unmount", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const view = render(
      <SessionEventsProvider>
        <TestSubscriber onEvent={vi.fn()} />
      </SessionEventsProvider>,
    );
    const source = MockEventSource.latest("/session-events/events");

    act(() => {
      source?.emit({ type: "session.read", sessionId: "session-1" });
      source?.emitRaw("not-json");
    });

    expect(error).toHaveBeenCalledTimes(2);

    view.unmount();

    expect(source?.close).toHaveBeenCalledTimes(1);
  });

  it("revalidates after the stream recovers", () => {
    render(
      <SessionEventsProvider>
        <TestSubscriber onEvent={vi.fn()} />
      </SessionEventsProvider>,
    );

    const source = MockEventSource.latest("/session-events/events");

    act(() => {
      source?.open();
      source?.fail();
    });

    act(() => {
      vi.advanceTimersByTime(RECONNECT_DELAYS_MS[0]);
    });

    act(() => {
      MockEventSource.latest("/session-events/events")?.open();
    });

    expect(revalidateOnReconnect).toHaveBeenCalledTimes(1);
  });
});
