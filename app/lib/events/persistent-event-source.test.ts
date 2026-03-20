import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PersistentEventSource, RECONNECT_DELAYS_MS } from "~/lib/events/persistent-event-source";

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

  static reset() {
    MockEventSource.instances.clear();
  }

  static latest(url: string) {
    return MockEventSource.instances.get(url)?.at(-1) ?? null;
  }

  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent<string>);
  }

  open() {
    this.onopen?.();
  }

  fail() {
    this.onerror?.();
  }
}

describe("PersistentEventSource", () => {
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
  });

  it("forwards messages from the active stream", () => {
    const onMessage = vi.fn();

    new PersistentEventSource("/events", { onMessage });

    MockEventSource.latest("/events")?.emit({ ok: true });

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage.mock.calls[0]?.[0].data).toBe(JSON.stringify({ ok: true }));
  });

  it("reconnects with backoff and notifies after recovery", () => {
    const onReconnect = vi.fn();

    new PersistentEventSource("/events", { onReconnect });

    const first = MockEventSource.latest("/events");
    first?.open();

    first?.fail();
    expect(first?.close).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(RECONNECT_DELAYS_MS[0] - 1);
    expect(MockEventSource.instances.get("/events")).toHaveLength(1);

    vi.advanceTimersByTime(1);
    const second = MockEventSource.latest("/events");
    expect(MockEventSource.instances.get("/events")).toHaveLength(2);

    second?.open();

    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it("keeps increasing delay across repeated failures until open resets it", () => {
    new PersistentEventSource("/events");

    const first = MockEventSource.latest("/events");
    first?.fail();
    vi.advanceTimersByTime(RECONNECT_DELAYS_MS[0]);

    const second = MockEventSource.latest("/events");
    second?.fail();
    vi.advanceTimersByTime(RECONNECT_DELAYS_MS[1] - 1);
    expect(MockEventSource.instances.get("/events")).toHaveLength(2);

    vi.advanceTimersByTime(1);
    const third = MockEventSource.latest("/events");
    expect(MockEventSource.instances.get("/events")).toHaveLength(3);

    third?.open();
    third?.fail();
    vi.advanceTimersByTime(RECONNECT_DELAYS_MS[0]);

    expect(MockEventSource.instances.get("/events")).toHaveLength(4);
  });

  it("stops reconnecting after close", () => {
    const source = new PersistentEventSource("/events");
    const first = MockEventSource.latest("/events");

    first?.fail();
    source.close();

    vi.advanceTimersByTime(RECONNECT_DELAYS_MS.at(-1) ?? 0);

    expect(MockEventSource.instances.get("/events")).toHaveLength(1);
    expect(first?.close).toHaveBeenCalledTimes(1);
  });
});
