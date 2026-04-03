// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withTestDatabase } from "~/lib/db.server";
import { listRecentModelChoices, recordModelUsage } from "~/lib/model-usage.server";

const getProjectMock = vi.fn();
const getSharedOpencodeServerUrlMock = vi.fn();
const listProjectsMock = vi.fn();
const subscribeToProjectRuntimeEventsMock = vi.fn();

vi.mock("~/lib/projects/runtime.server", () => ({
  getProject: (...args: unknown[]) => getProjectMock(...args),
  listProjects: (...args: unknown[]) => listProjectsMock(...args),
  subscribeToProjectRuntimeEvents: (...args: unknown[]) => subscribeToProjectRuntimeEventsMock(...args),
}));

vi.mock("~/lib/opencode/shared-runtime.server", () => ({
  createProjectScopedHeaders(directory: string, headers?: HeadersInit) {
    const nextHeaders = new Headers(headers);
    nextHeaders.set("x-opencode-directory", encodeURIComponent(directory));
    return nextHeaders;
  },
  getSharedOpencodeServerUrl: (...args: unknown[]) => getSharedOpencodeServerUrlMock(...args),
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
    listProjectsMock.mockReset();
    getProjectMock.mockReset();
    getSharedOpencodeServerUrlMock.mockReset();
    subscribeToProjectRuntimeEventsMock.mockReset();
    subscribeToProjectRuntimeEventsMock.mockReturnValue(() => {});
    getSharedOpencodeServerUrlMock.mockResolvedValue("http://127.0.0.1:44556");
    listProjectsMock.mockResolvedValue([]);
    getProjectMock.mockResolvedValue(null);
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

  it("fans in root session events from running projects", async () => {
    const stream = createEventStream();
    let onRuntimeEvent: ((event: any) => void) | null = null;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(stream.stream, {
      headers: {
        "Content-Type": "text/event-stream",
      },
      status: 200,
    }));

    listProjectsMock.mockResolvedValue([
      {
        id: "project-1",
        name: "Alpha",
        directory: "/tmp/alpha",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ]);
    getProjectMock.mockResolvedValue({
      id: "project-1",
      name: "Alpha",
      directory: "/tmp/alpha",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    subscribeToProjectRuntimeEventsMock.mockImplementation((handler: (event: any) => void) => {
      onRuntimeEvent = handler;
      return () => {};
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
        case "session.status":
          received.push({ type: event.type, value: event.status.type });
          return;
        case "session.deleted":
          received.push({ type: event.type, value: event.sessionId });
          return;
        case "session.question.asked":
        case "session.question.rejected":
        case "project.changed":
        case "project.removed":
          received.push({
            type: event.type,
            value: event.type === "project.changed"
              ? event.project.id
              : event.type === "project.removed"
                ? event.projectId
                : event.requestId,
          });
      }
    });

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://127.0.0.1:44556/event",
        expect.objectContaining({
          headers: expect.any(Headers),
        }),
      );
    });

    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("x-opencode-directory")).toBe("%2Ftmp%2Falpha");

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
      type: "session.status",
      properties: {
        sessionID: "session-1",
        status: { type: "busy" },
      },
    });
    stream.emit({
      type: "question.asked",
      properties: {
        id: "question-1",
        sessionID: "session-1",
        questions: [
          {
            question: "Continue?",
            header: "Continue",
            options: [{ label: "Yes", description: "Continue" }],
          },
        ],
      },
    });
    stream.emit({
      type: "question.rejected",
      properties: {
        sessionID: "session-1",
        requestID: "question-1",
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

    if (!onRuntimeEvent) {
      throw new Error("Missing runtime event handler");
    }

    const runtimeEventHandler = onRuntimeEvent as (event: any) => void;

    runtimeEventHandler({
      type: "project.changed",
      project: {
        id: "project-2",
        name: "Beta",
        directory: "/tmp/beta",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    });
    runtimeEventHandler({
      type: "project.removed",
      projectId: "project-2",
    });

    await vi.waitFor(() => {
      expect(received).toEqual(expect.arrayContaining([
        { type: "session.summary", value: "session-1" },
        { type: "session.activity", value: 15 },
        { type: "session.activity", value: 20 },
        { type: "session.status", value: "busy" },
        { type: "session.question.asked", value: "question-1" },
        { type: "session.question.rejected", value: "question-1" },
        { type: "session.deleted", value: "session-1" },
        { type: "project.changed", value: "project-2" },
        { type: "project.removed", value: "project-2" },
      ]));
      expect(received.filter((event) => event.type === "session.activity")).toHaveLength(3);
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

      listProjectsMock.mockResolvedValue([
        {
          id: "project-1",
          name: "Alpha",
          directory: "/tmp/alpha",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ]);
      getProjectMock.mockResolvedValue({
        id: "project-1",
        name: "Alpha",
        directory: "/tmp/alpha",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });

      recordModelUsage({
        projectId: "project-1",
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
          project: {
            id: "project-1",
            name: "Alpha",
            directory: "/tmp/alpha",
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
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

      listProjectsMock.mockResolvedValue([
        {
          id: "project-1",
          name: "Alpha",
          directory: "/tmp/alpha",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ]);
      getProjectMock.mockResolvedValue({
        id: "project-1",
        name: "Alpha",
        directory: "/tmp/alpha",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });

      recordModelUsage({
        projectId: "project-1",
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
          project: {
            id: "project-1",
            name: "Alpha",
            directory: "/tmp/alpha",
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          },
          providers: [{ id: "openai", models: { "gpt-5": { id: "gpt-5", name: "GPT 5", variants: { high: {} } } }, name: "OpenAI" }],
        })).resolves.toEqual([]);
      });

      unsubscribe();
    });
  });
});
