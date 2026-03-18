import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ReadStatusEventsProvider,
  useReadStatusEvents,
  type SessionReadEvent,
} from "~/components/events/read-status-events-provider";

class MockEventSource {
  static instances = new Map<string, MockEventSource>();

  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  readonly close = vi.fn();

  constructor(public readonly url: string) {
    MockEventSource.instances.set(url, this);
  }

  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent<string>);
  }

  emitRaw(data: string) {
    this.onmessage?.({ data } as MessageEvent<string>);
  }

  static reset() {
    MockEventSource.instances.clear();
  }
}

function TestSubscriber({
  filter,
  onEvent,
}: {
  filter?: { instanceId?: string; sessionId?: string };
  onEvent: (event: SessionReadEvent) => void;
}) {
  useReadStatusEvents(onEvent, filter);
  return null;
}

function emitReadStatusEvent(payload: unknown) {
  const source = MockEventSource.instances.get("/session-read-status/events");

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
  });

  afterEach(() => {
    MockEventSource.reset();
    globalThis.EventSource = originalEventSource;
    vi.restoreAllMocks();
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
      instanceId: "instance-1",
      sessionId: "session-1",
      lastReadAt: 6,
    });

    expect(onEvent).toHaveBeenCalledWith({
      type: "session.read",
      instanceId: "instance-1",
      sessionId: "session-1",
      lastReadAt: 6,
    });
  });

  it("filters by instance and session", () => {
    const onEvent = vi.fn<(event: SessionReadEvent) => void>();

    render(
      <ReadStatusEventsProvider>
        <TestSubscriber filter={{ instanceId: "instance-1", sessionId: "session-1" }} onEvent={onEvent} />
      </ReadStatusEventsProvider>,
    );

    emitReadStatusEvent({
      type: "session.read",
      instanceId: "instance-2",
      sessionId: "session-1",
      lastReadAt: 6,
    });

    emitReadStatusEvent({
      type: "session.read",
      instanceId: "instance-1",
      sessionId: "session-2",
      lastReadAt: 6,
    });

    emitReadStatusEvent({
      type: "session.read",
      instanceId: "instance-1",
      sessionId: "session-1",
      lastReadAt: 6,
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      type: "session.read",
      instanceId: "instance-1",
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
    const source = MockEventSource.instances.get("/session-read-status/events");

    act(() => {
      source?.emit({ type: "session.read", sessionId: "session-1" });
      source?.emitRaw("not-json");
    });

    expect(error).toHaveBeenCalledTimes(2);

    view.unmount();

    expect(source?.close).toHaveBeenCalledTimes(1);
  });
});
