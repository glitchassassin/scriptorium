import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidateOnReconnect = vi.fn();

vi.mock("~/components/events/use-coalesced-revalidation", () => ({
  useCoalescedRevalidation: () => revalidateOnReconnect,
}));

import {
  GlobalEventsProvider,
  useGlobalEvents,
  type FilteredGlobalEvent,
  type GlobalEvent,
  type GlobalEventFilter,
} from "~/components/events/global-events-provider";

class MockEventSource {
  static instances = new Map<string, MockEventSource[]>();

  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readonly close = vi.fn();

  constructor(public readonly url: string) {
    const list = MockEventSource.instances.get(url) ?? [];
    list.push(this);
    MockEventSource.instances.set(url, list);
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

  static latest(url: string) {
    return MockEventSource.instances.get(url)?.at(-1);
  }

  static reset() {
    MockEventSource.instances.clear();
  }
}

type TestSubscriberProps<TTypes extends readonly GlobalEvent["payload"]["type"][] | undefined = undefined> = {
  filter?: GlobalEventFilter<TTypes>;
  onEvent: (event: FilteredGlobalEvent<TTypes>) => void;
};

function TestSubscriber<TTypes extends readonly GlobalEvent["payload"]["type"][] | undefined = undefined>({
  filter,
  onEvent,
}: TestSubscriberProps<TTypes>) {
  useGlobalEvents(onEvent, filter);
  return null;
}

describe("useGlobalEvents", () => {
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

  it("delivers parsed global events to subscribers", () => {
    const onEvent = vi.fn<(event: GlobalEvent) => void>();

    render(
      <GlobalEventsProvider>
        <TestSubscriber onEvent={onEvent} />
      </GlobalEventsProvider>,
    );

    act(() => {
      MockEventSource.latest("/global-events/events")?.emit({
        directory: "/tmp/alpha",
        payload: {
          type: "installation.updated",
          properties: { version: "1.4.0" },
        },
      });
    });

    expect(onEvent).toHaveBeenCalledWith({
      directory: "/tmp/alpha",
      payload: {
        type: "installation.updated",
        properties: { version: "1.4.0" },
      },
    });
  });

  it("filters by directory and payload type", () => {
    const onEvent = vi.fn<(event: FilteredGlobalEvent<readonly ["server.instance.disposed"]>) => void>();

    render(
      <GlobalEventsProvider>
        <TestSubscriber
          filter={{
            directory: "/tmp/alpha",
            types: ["server.instance.disposed"] as const,
          }}
          onEvent={onEvent}
        />
      </GlobalEventsProvider>,
    );

    act(() => {
      MockEventSource.latest("/global-events/events")?.emit({
        directory: "/tmp/beta",
        payload: {
          type: "server.instance.disposed",
          properties: { directory: "/tmp/beta" },
        },
      });
      MockEventSource.latest("/global-events/events")?.emit({
        directory: "/tmp/alpha",
        payload: {
          type: "installation.updated",
          properties: { version: "1.4.0" },
        },
      });
      MockEventSource.latest("/global-events/events")?.emit({
        directory: "/tmp/alpha",
        payload: {
          type: "server.instance.disposed",
          properties: { directory: "/tmp/alpha" },
        },
      });
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      directory: "/tmp/alpha",
      payload: {
        type: "server.instance.disposed",
        properties: { directory: "/tmp/alpha" },
      },
    });
  });

  it("accepts heartbeat events without a directory", () => {
    const onEvent = vi.fn<(event: GlobalEvent) => void>();

    render(
      <GlobalEventsProvider>
        <TestSubscriber onEvent={onEvent} />
      </GlobalEventsProvider>,
    );

    act(() => {
      MockEventSource.latest("/global-events/events")?.emit({
        payload: {
          type: "server.heartbeat",
          properties: {},
        },
      });
    });

    expect(onEvent).toHaveBeenCalledWith({
      directory: null,
      payload: {
        type: "server.heartbeat",
        properties: {},
      },
    });
  });
});
