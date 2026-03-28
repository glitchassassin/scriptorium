// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withTestDatabase } from "~/lib/db.server";
import { listRecentModelChoices, recordModelUsage } from "~/lib/model-usage.server";

const getInstanceMock = vi.fn();
const listInstancesMock = vi.fn();
const subscribeToInstanceRuntimeEventsMock = vi.fn();

vi.mock("~/lib/instances/runtime.server", () => ({
  getInstance: (...args: unknown[]) => getInstanceMock(...args),
  listInstances: (...args: unknown[]) => listInstancesMock(...args),
  subscribeToInstanceRuntimeEvents: (...args: unknown[]) => subscribeToInstanceRuntimeEventsMock(...args),
}));

import {
  markSessionRead,
  resetSessionEventsForTests,
  subscribeToSessionEvents,
} from "~/lib/session-events.server";

function createEventStream() {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(nextController) {
      controller = nextController;
    },
  });

  return {
    emit(payload: unknown) {
      controller?.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`));
    },
    stream,
  };
}

describe("session events", () => {
  beforeEach(() => {
    listInstancesMock.mockReset();
    getInstanceMock.mockReset();
    subscribeToInstanceRuntimeEventsMock.mockReset();
    subscribeToInstanceRuntimeEventsMock.mockReturnValue(() => {});
    listInstancesMock.mockResolvedValue([]);
    getInstanceMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetSessionEventsForTests();
  });

  it("publishes read events to subscribers", async () => {
    await withTestDatabase(async () => {
      const received: number[] = [];
      const unsubscribe = subscribeToSessionEvents((event) => {
        if (event.type === "session.read") {
          received.push(event.lastReadAt);
        }
      }, {
        types: ["session.read"],
      });

      markSessionRead({ sessionId: "session-1" }, new Date("2026-03-18T12:00:00.000Z"));

      unsubscribe();

      expect(received).toEqual([Date.parse("2026-03-18T12:00:00.000Z")]);
    });
  });

  it("fans in root session events from running instances", async () => {
    const stream = createEventStream();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(stream.stream, {
      headers: {
        "Content-Type": "text/event-stream",
      },
      status: 200,
    }));

    listInstancesMock.mockResolvedValue([
      {
        id: "instance-1",
        name: "Alpha",
        directory: "/tmp/alpha",
        port: 4311,
        status: "running",
      },
    ]);
    getInstanceMock.mockResolvedValue({
      id: "instance-1",
      name: "Alpha",
      directory: "/tmp/alpha",
      port: 4311,
      status: "running",
    });

    const received: Array<{ type: string; value: string | number }> = [];
    const unsubscribe = subscribeToSessionEvents((event) => {
      switch (event.type) {
        case "session.summary":
          received.push({ type: event.type, value: event.summary.id });
          return;
        case "session.activity":
          received.push({ type: event.type, value: event.updatedAt });
          return;
        case "session.deleted":
          received.push({ type: event.type, value: event.sessionId });
      }
    });

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://127.0.0.1:4311/event",
        expect.objectContaining({
          headers: { Accept: "text/event-stream" },
        }),
      );
    });

    stream.emit({
      type: "session.updated",
      properties: {
        info: {
          id: "session-1",
          directory: "/tmp/alpha",
          time: { created: 10, updated: 15 },
          title: "Session 1",
        },
      },
    });
    stream.emit({
      type: "message.updated",
      properties: {
        info: {
          id: "message-1",
          sessionID: "session-1",
          role: "user",
          time: { created: 20 },
        },
      },
    });
    stream.emit({
      type: "session.deleted",
      properties: {
        info: {
          id: "session-1",
          directory: "/tmp/alpha",
          time: { created: 10, updated: 15 },
          title: "Session 1",
        },
      },
    });

    await vi.waitFor(() => {
      expect(received).toEqual([
        { type: "session.summary", value: "session-1" },
        { type: "session.activity", value: 15 },
        { type: "session.activity", value: 20 },
        { type: "session.deleted", value: "session-1" },
      ]);
    });

    unsubscribe();
  });

  it("clears cached model usage when a message is removed", async () => {
    await withTestDatabase(async () => {
      const stream = createEventStream();
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(stream.stream, {
        headers: {
          "Content-Type": "text/event-stream",
        },
        status: 200,
      }));

      listInstancesMock.mockResolvedValue([
        {
          id: "instance-1",
          name: "Alpha",
          directory: "/tmp/alpha",
          port: 4311,
          status: "running",
        },
      ]);
      getInstanceMock.mockResolvedValue({
        id: "instance-1",
        name: "Alpha",
        directory: "/tmp/alpha",
        port: 4311,
        status: "running",
      });

      recordModelUsage({
        instanceId: "instance-1",
        model: { modelID: "gpt-5", providerID: "openai" },
        sessionId: "session-1",
        usedAt: 20,
        variant: "high",
      });

      const unsubscribe = subscribeToSessionEvents(() => {});

      await vi.waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });

      stream.emit({
        type: "message.removed",
        properties: {
          messageID: "message-1",
          sessionID: "session-1",
        },
      });

      await vi.waitFor(async () => {
        await expect(listRecentModelChoices({
          instance: {
            id: "instance-1",
            name: "Alpha",
            directory: "/tmp/alpha",
            port: 4311,
            status: "running",
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
            lastStartedAt: null,
            lastExitAt: null,
            lastError: null,
          },
          providers: [{ id: "openai", models: { "gpt-5": { id: "gpt-5", name: "GPT 5", variants: { high: {} } } }, name: "OpenAI" }],
        })).resolves.toEqual([]);
      });

      unsubscribe();
    });
  });

  it("clears cached model usage when a session update carries revert state", async () => {
    await withTestDatabase(async () => {
      const stream = createEventStream();
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(stream.stream, {
        headers: {
          "Content-Type": "text/event-stream",
        },
        status: 200,
      }));

      listInstancesMock.mockResolvedValue([
        {
          id: "instance-1",
          name: "Alpha",
          directory: "/tmp/alpha",
          port: 4311,
          status: "running",
        },
      ]);
      getInstanceMock.mockResolvedValue({
        id: "instance-1",
        name: "Alpha",
        directory: "/tmp/alpha",
        port: 4311,
        status: "running",
      });

      recordModelUsage({
        instanceId: "instance-1",
        model: { modelID: "gpt-5", providerID: "openai" },
        sessionId: "session-1",
        usedAt: 20,
        variant: "high",
      });

      const unsubscribe = subscribeToSessionEvents(() => {});

      await vi.waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });

      stream.emit({
        type: "session.updated",
        properties: {
          info: {
            directory: "/tmp/alpha",
            id: "session-1",
            revert: { messageID: "message-1" },
            time: { created: 10, updated: 15 },
            title: "Session 1",
          },
        },
      });

      await vi.waitFor(async () => {
        await expect(listRecentModelChoices({
          instance: {
            id: "instance-1",
            name: "Alpha",
            directory: "/tmp/alpha",
            port: 4311,
            status: "running",
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
            lastStartedAt: null,
            lastExitAt: null,
            lastError: null,
          },
          providers: [{ id: "openai", models: { "gpt-5": { id: "gpt-5", name: "GPT 5", variants: { high: {} } } }, name: "OpenAI" }],
        })).resolves.toEqual([]);
      });

      unsubscribe();
    });
  });
});
