import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  InstanceEventsProvider,
  useInstanceEvents,
  type FilteredInstanceEvent,
  type InstanceEvent,
  type InstanceEventFilter,
} from "~/components/events/instance-events-provider";

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

type TestSubscriberProps<TTypes extends readonly InstanceEvent["type"][] | undefined = undefined> = {
  filter?: InstanceEventFilter<TTypes>;
  onEvent: (event: FilteredInstanceEvent<TTypes>) => void;
};

function TestSubscriber<TTypes extends readonly InstanceEvent["type"][] | undefined = undefined>({
  filter,
  onEvent,
}: TestSubscriberProps<TTypes>) {
  useInstanceEvents(onEvent, filter);
  return null;
}

function emitInstanceEvent(instanceId: string, payload: unknown) {
  const source = MockEventSource.instances.get(`/instances/${instanceId}/proxy/event`);

  if (!source) {
    throw new Error(`Missing mock EventSource for instance ${instanceId}.`);
  }

  act(() => {
    source.emit(payload);
  });
}

describe("useInstanceEvents", () => {
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

  it("delivers known parsed events to subscribers", () => {
    const onEvent = vi.fn<(event: InstanceEvent) => void>();

    render(
      <InstanceEventsProvider instanceIds={["alpha"]}>
        <TestSubscriber onEvent={onEvent} />
      </InstanceEventsProvider>,
    );

    emitInstanceEvent("alpha", {
      type: "session.status",
      properties: {
        sessionID: "session-1",
        status: { type: "busy" },
      },
    });

    expect(onEvent).toHaveBeenCalledWith({
      instanceId: "alpha",
      type: "session.status",
      properties: {
        sessionID: "session-1",
        status: { type: "busy" },
      },
    });
  });

  it("filters by instance, session, and event type", () => {
    const onEvent = vi.fn<(event: FilteredInstanceEvent<readonly ["message.updated", "session.status"]>) => void>();

    render(
      <InstanceEventsProvider instanceIds={["alpha", "beta"]}>
        <TestSubscriber
          filter={{
            instanceId: "alpha",
            sessionId: "session-1",
            types: ["message.updated", "session.status"] as const,
          }}
          onEvent={onEvent}
        />
      </InstanceEventsProvider>,
    );

    emitInstanceEvent("beta", {
      type: "session.status",
      properties: {
        sessionID: "session-1",
        status: { type: "busy" },
      },
    });

    emitInstanceEvent("alpha", {
      type: "message.updated",
      properties: {
        info: {
          id: "message-1",
          sessionID: "session-2",
          role: "user",
          time: { created: 1 },
        },
      },
    });

    emitInstanceEvent("alpha", {
      type: "message.part.updated",
      properties: {
        part: {
          id: "part-1",
          sessionID: "session-1",
          messageID: "message-1",
          type: "text",
          text: "hello",
        },
      },
    });

    emitInstanceEvent("alpha", {
      type: "session.status",
      properties: {
        sessionID: "session-1",
        status: { type: "retry", attempt: 2, message: "wait", next: 123 },
      },
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      instanceId: "alpha",
      type: "session.status",
      properties: {
        sessionID: "session-1",
        status: { type: "retry", attempt: 2, message: "wait", next: 123 },
      },
    });
  });

  it("warns for unknown event types and errors for invalid known events", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const onEvent = vi.fn<(event: InstanceEvent) => void>();

    render(
      <InstanceEventsProvider instanceIds={["alpha"]}>
        <TestSubscriber onEvent={onEvent} />
      </InstanceEventsProvider>,
    );

    emitInstanceEvent("alpha", {
      type: "unknown.event",
      properties: {},
    });

    emitInstanceEvent("alpha", {
      type: "session.status",
      properties: {
        sessionID: "session-1",
      },
    });

    act(() => {
      MockEventSource.instances.get(`/instances/alpha/proxy/event`)?.emitRaw("not-json");
    });

    expect(onEvent).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(2);
  });

  it("closes removed instance streams and unsubscribes on unmount", () => {
    const onEvent = vi.fn<(event: InstanceEvent) => void>();
    const view = render(
      <InstanceEventsProvider instanceIds={["alpha", "beta"]}>
        <TestSubscriber onEvent={onEvent} />
      </InstanceEventsProvider>,
    );

    const alphaSource = MockEventSource.instances.get(`/instances/alpha/proxy/event`);
    const betaSource = MockEventSource.instances.get(`/instances/beta/proxy/event`);

    view.rerender(
      <InstanceEventsProvider instanceIds={["alpha"]}>
        <TestSubscriber onEvent={onEvent} />
      </InstanceEventsProvider>,
    );

    expect(betaSource?.close).toHaveBeenCalledTimes(1);

    view.unmount();

    expect(alphaSource?.close).toHaveBeenCalledTimes(1);
  });
});
