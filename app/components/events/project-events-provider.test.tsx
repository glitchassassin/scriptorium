import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidateOnReconnect = vi.fn();

vi.mock("~/components/events/use-coalesced-revalidation", () => ({
  useCoalescedRevalidation: () => revalidateOnReconnect,
}));

import {
  ProjectEventsProvider,
  useProjectEvents,
  type FilteredProjectEvent,
  type ProjectEvent,
  type ProjectEventFilter,
} from "~/components/events/project-events-provider";
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

type TestSubscriberProps<TTypes extends readonly ProjectEvent["type"][] | undefined = undefined> = {
  filter?: ProjectEventFilter<TTypes>;
  onEvent: (event: FilteredProjectEvent<TTypes>) => void;
};

function TestSubscriber<TTypes extends readonly ProjectEvent["type"][] | undefined = undefined>({
  filter,
  onEvent,
}: TestSubscriberProps<TTypes>) {
  useProjectEvents(onEvent, filter);
  return null;
}

function emitProjectEvent(projectId: string, payload: unknown) {
  const source = MockEventSource.latest(`/projects/${projectId}/proxy/event`);

  if (!source) {
    throw new Error(`Missing mock EventSource for project ${projectId}.`);
  }

  act(() => {
    source.emit(payload);
  });
}

describe("useProjectEvents", () => {
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

  it("delivers known parsed events to subscribers", () => {
    const onEvent = vi.fn<(event: ProjectEvent) => void>();

    render(
      <ProjectEventsProvider projectIds={["alpha"]}>
        <TestSubscriber onEvent={onEvent} />
      </ProjectEventsProvider>,
    );

    emitProjectEvent("alpha", {
      type: "session.status",
      properties: {
        sessionID: "session-1",
        status: { type: "busy" },
      },
    });

    expect(onEvent).toHaveBeenCalledWith({
      projectId: "alpha",
      type: "session.status",
      properties: {
        sessionID: "session-1",
        status: { type: "busy" },
      },
    });
  });

  it("filters by project, session, and event type", () => {
    const onEvent = vi.fn<(event: FilteredProjectEvent<readonly ["message.updated", "session.status"]>) => void>();

    render(
      <ProjectEventsProvider projectIds={["alpha", "beta"]}>
        <TestSubscriber
          filter={{
            projectId: "alpha",
            sessionId: "session-1",
            types: ["message.updated", "session.status"] as const,
          }}
          onEvent={onEvent}
        />
      </ProjectEventsProvider>,
    );

    emitProjectEvent("beta", {
      type: "session.status",
      properties: {
        sessionID: "session-1",
        status: { type: "busy" },
      },
    });

    emitProjectEvent("alpha", {
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

    emitProjectEvent("alpha", {
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

    emitProjectEvent("alpha", {
      type: "session.status",
      properties: {
        sessionID: "session-1",
        status: { type: "retry", attempt: 2, message: "wait", next: 123 },
      },
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      projectId: "alpha",
      type: "session.status",
      properties: {
        sessionID: "session-1",
        status: { type: "retry", attempt: 2, message: "wait", next: 123 },
      },
    });
  });

  it("routes question events by session", () => {
    const onEvent = vi.fn<
      (event: FilteredProjectEvent<readonly ["question.asked", "question.rejected"]>) => void
    >();

    render(
      <ProjectEventsProvider projectIds={["alpha"]}>
        <TestSubscriber
          filter={{
            projectId: "alpha",
            sessionId: "session-1",
            types: ["question.asked", "question.rejected"] as const,
          }}
          onEvent={onEvent}
        />
      </ProjectEventsProvider>,
    );

    emitProjectEvent("alpha", {
      type: "question.asked",
      properties: {
        id: "question-1",
        sessionID: "session-2",
        questions: [
          {
            question: "What next?",
            header: "Next",
            options: [{ label: "Test", description: "Run tests" }],
          },
        ],
      },
    });

    emitProjectEvent("alpha", {
      type: "question.rejected",
      properties: {
        sessionID: "session-1",
        requestID: "question-1",
      },
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      projectId: "alpha",
      type: "question.rejected",
      properties: {
        sessionID: "session-1",
        requestID: "question-1",
      },
    });
  });

  it("warns for unknown event types and errors for invalid known events", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const onEvent = vi.fn<(event: ProjectEvent) => void>();

    render(
      <ProjectEventsProvider projectIds={["alpha"]}>
        <TestSubscriber onEvent={onEvent} />
      </ProjectEventsProvider>,
    );

    emitProjectEvent("alpha", {
      type: "unknown.event",
      properties: {},
    });

    emitProjectEvent("alpha", {
      type: "session.status",
      properties: {
        sessionID: "session-1",
      },
    });

    act(() => {
      MockEventSource.latest(`/projects/alpha/proxy/event`)?.emitRaw("not-json");
    });

    expect(onEvent).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(2);
  });

  it("closes removed project streams and unsubscribes on unmount", () => {
    const onEvent = vi.fn<(event: ProjectEvent) => void>();
    const view = render(
      <ProjectEventsProvider projectIds={["alpha", "beta"]}>
        <TestSubscriber onEvent={onEvent} />
      </ProjectEventsProvider>,
    );

    const alphaSource = MockEventSource.instances.get(`/projects/alpha/proxy/event`);
    const betaSource = MockEventSource.latest(`/projects/beta/proxy/event`);

    view.rerender(
      <ProjectEventsProvider projectIds={["alpha"]}>
        <TestSubscriber onEvent={onEvent} />
      </ProjectEventsProvider>,
    );

    expect(betaSource?.close).toHaveBeenCalledTimes(1);

    view.unmount();

    expect(alphaSource?.at(-1)?.close).toHaveBeenCalledTimes(1);
  });

  it("revalidates after a project stream recovers", () => {
    render(
      <ProjectEventsProvider projectIds={["alpha", "beta"]}>
        <TestSubscriber onEvent={vi.fn()} />
      </ProjectEventsProvider>,
    );

    const alphaSource = MockEventSource.latest("/projects/alpha/proxy/event");
    const betaSource = MockEventSource.latest("/projects/beta/proxy/event");

    act(() => {
      alphaSource?.open();
      alphaSource?.fail();
      betaSource?.fail();
    });

    act(() => {
      vi.advanceTimersByTime(RECONNECT_DELAYS_MS[0]);
    });

    act(() => {
      MockEventSource.latest("/projects/alpha/proxy/event")?.open();
      MockEventSource.latest("/projects/beta/proxy/event")?.open();
    });

    expect(revalidateOnReconnect).toHaveBeenCalledTimes(2);
  });
});
