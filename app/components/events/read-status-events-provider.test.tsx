import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidateOnReconnect = vi.fn();

vi.mock("~/components/events/use-coalesced-revalidation", () => ({
  useCoalescedRevalidation: () => revalidateOnReconnect,
}));

import {
  ReadStatusEventsProvider,
  useReadStatusEvents,
  type SessionReadEvent,
} from "~/components/events/read-status-events-provider";
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
  onEvent: (event: SessionReadEvent) => void;
}) {
  useReadStatusEvents(onEvent, filter);
  return null;
}

function emitReadStatusEvent(payload: unknown) {
  const source = MockEventSource.latest("/session-read-status/events");

  if (!source) {
    throw new Error("Missing mock EventSource for read status events.");
  }

  act(() => {
    source.emit(payload);
  });
}

describe("useReadStatusEvents", () => {
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
    const onEvent = vi.fn<(event: SessionReadEvent) => void>();

    render(
      <ReadStatusEventsProvider>
        <TestSubscriber onEvent={onEvent} />
      </ReadStatusEventsProvider>,
    );

    emitReadStatusEvent({
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
    const onEvent = vi.fn<(event: SessionReadEvent) => void>();

    render(
      <ReadStatusEventsProvider>
        <TestSubscriber filter={{ sessionId: "session-1" }} onEvent={onEvent} />
      </ReadStatusEventsProvider>,
    );

    emitReadStatusEvent({
      type: "session.read",
      sessionId: "session-2",
      lastReadAt: 6,
    });

    emitReadStatusEvent({
      type: "session.read",
      sessionId: "session-1",
      lastReadAt: 6,
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      type: "session.read",
      sessionId: "session-1",
      lastReadAt: 6,
    });
  });

  it("logs invalid payloads and closes the source on unmount", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const view = render(
      <ReadStatusEventsProvider>
        <TestSubscriber onEvent={vi.fn()} />
      </ReadStatusEventsProvider>,
    );
    const source = MockEventSource.latest("/session-read-status/events");

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
      <ReadStatusEventsProvider>
        <TestSubscriber onEvent={vi.fn()} />
      </ReadStatusEventsProvider>,
    );

    const source = MockEventSource.latest("/session-read-status/events");

    act(() => {
      source?.open();
      source?.fail();
    });

    act(() => {
      vi.advanceTimersByTime(RECONNECT_DELAYS_MS[0]);
    });

    act(() => {
      MockEventSource.latest("/session-read-status/events")?.open();
    });

    expect(revalidateOnReconnect).toHaveBeenCalledTimes(1);
  });
});
