// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProjectRecord } from "~/lib/projects/types";

const getSharedOpencodeServerUrlMock = vi.fn();

vi.mock("~/lib/opencode/shared-runtime.server", () => ({
  createProjectScopedHeaders(directory: string, headers?: HeadersInit) {
    const nextHeaders = new Headers(headers);
    nextHeaders.set("x-opencode-directory", encodeURIComponent(directory));
    return nextHeaders;
  },
  getSharedOpencodeServerUrl: (...args: unknown[]) => getSharedOpencodeServerUrlMock(...args),
}));

import {
  forkOpencodeSession,
  getOpencodeConfig,
  getOpencodeProviderCatalog,
  listRecentSidebarSessions,
  listOpencodeMessagePage,
  listOpencodeQuestionRequests,
  rejectOpencodeQuestionRequest,
  replyToOpencodeQuestionRequest,
  revertOpencodeSession,
  submitOpencodeCommand,
  submitOpencodePrompt,
  unrevertOpencodeSession,
} from "~/lib/projects/opencode.server";

const project: ProjectRecord = {
  id: "project-1",
  name: "test",
  directory: "/tmp",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

afterEach(() => {
  vi.restoreAllMocks();
  getSharedOpencodeServerUrlMock.mockReset();
  getSharedOpencodeServerUrlMock.mockResolvedValue("http://127.0.0.1:44556");
});

getSharedOpencodeServerUrlMock.mockResolvedValue("http://127.0.0.1:44556");

describe("submitOpencodePrompt", () => {
  it("sends prompt parts and overrides only when selected", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));

    await submitOpencodePrompt(project, "session-1", {
      parts: [{ type: "text", text: "Hello" }],
    });
    await submitOpencodePrompt(project, "session-1", {
      parts: [
        { type: "text", text: "Hello" },
        {
          type: "file",
          filename: "image.png",
          mime: "image/png",
          url: "data:image/png;base64,ZmFrZQ==",
        },
      ],
      agent: "analysis",
      model: {
        modelID: "gpt-5",
        providerID: "openai",
      },
      variant: "high",
    });

    const firstPayload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const secondPayload = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));

    expect(firstPayload).toEqual({
      parts: [
        {
          type: "text",
          text: "Hello",
        },
      ],
    });

    expect(secondPayload).toEqual({
      parts: [
        {
          type: "text",
          text: "Hello",
        },
        {
          type: "file",
          filename: "image.png",
          mime: "image/png",
          url: "data:image/png;base64,ZmFrZQ==",
        },
      ],
      agent: "analysis",
      model: {
        modelID: "gpt-5",
        providerID: "openai",
      },
      variant: "high",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:44556/session/session-1/prompt_async");
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("x-opencode-directory")).toBe("%2Ftmp");
  });
});

describe("listOpencodeMessagePage", () => {
  it("loads message pages and exposes the next cursor", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([
      {
        info: {
          id: "message-2",
          sessionID: "session-1",
          role: "assistant",
          parentID: "message-1",
          time: { created: 2 },
        },
        parts: [],
      },
    ]), {
      headers: {
        "X-Next-Cursor": "cursor-1",
      },
    }));

    await expect(listOpencodeMessagePage(project, "session-1", { before: "cursor-0", limit: 25 })).resolves.toEqual({
      hasMore: true,
      items: [
        {
          info: {
            id: "message-2",
            sessionID: "session-1",
            role: "assistant",
            parentID: "message-1",
            time: { created: 2 },
          },
          parts: [],
        },
      ],
      nextCursor: "cursor-1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:44556/session/session-1/message?limit=25&before=cursor-0",
      expect.anything(),
    );
  });

  it("marks history complete when the next cursor header is absent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([])));

    await expect(listOpencodeMessagePage(project, "session-1", { limit: 10 })).resolves.toEqual({
      hasMore: false,
      items: [],
      nextCursor: null,
    });
  });
});

describe("listRecentSidebarSessions", () => {
  it("keeps the sidebar rooted in recent top-level sessions only", async () => {
    const now = 10_000_000_000;

    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([
      {
        id: "session-root-old",
        directory: "/tmp",
        time: { created: 1, updated: 1 },
      },
      {
        id: "session-child-new",
        parentID: "session-root-old",
        directory: "/tmp",
        time: { created: 1, updated: now - 60_000 },
      },
      {
        id: "session-root-new",
        directory: "/tmp",
        time: { created: 1, updated: now - 60_000 },
      },
    ])));

    await expect(listRecentSidebarSessions(project, now)).resolves.toEqual([
      {
        id: "session-root-new",
        parentID: null,
        title: null,
        directory: "/tmp",
        createdAt: 1,
        updatedAt: now - 60_000,
      },
    ]);
  });
});

describe("submitOpencodeCommand", () => {
  it("sends command overrides only when selected", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ info: {}, parts: [] })));

    await submitOpencodeCommand(project, "session-1", {
      arguments: "feature-branch",
      command: "review",
    });
    await submitOpencodeCommand(project, "session-1", {
      agent: "analysis",
      arguments: "feature-branch",
      command: "review",
      model: "openai/gpt-5",
      variant: "high",
    });

    const firstPayload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const secondPayload = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));

    expect(firstPayload).toEqual({
      arguments: "feature-branch",
      command: "review",
    });

    expect(secondPayload).toEqual({
      agent: "analysis",
      arguments: "feature-branch",
      command: "review",
      model: "openai/gpt-5",
      variant: "high",
    });
  });
});

describe("getOpencodeProviderCatalog", () => {
  it("loads providers and defaults from the config endpoint", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      default: { openai: "gpt-5" },
      providers: [
        {
          id: "openai",
          models: {
            "gpt-5": {
              id: "gpt-5",
              name: "GPT 5",
              variants: {
                high: {},
              },
            },
          },
          name: "OpenAI",
        },
      ],
    })));

    await expect(getOpencodeProviderCatalog(project)).resolves.toEqual({
      default: { openai: "gpt-5" },
      providers: [
        {
          id: "openai",
          models: {
            "gpt-5": {
              id: "gpt-5",
              name: "GPT 5",
              variants: {
                high: {},
              },
            },
          },
          name: "OpenAI",
        },
      ],
    });
  });

  it("falls back when the config endpoint is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));

    await expect(getOpencodeProviderCatalog(project)).resolves.toEqual({
      default: {},
      providers: [],
    });
  });
});

describe("getOpencodeConfig", () => {
  it("loads the current config", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      model: "openai/gpt-5",
    })));

    await expect(getOpencodeConfig(project)).resolves.toEqual({
      model: "openai/gpt-5",
    });
  });

  it("falls back when the config endpoint is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));

    await expect(getOpencodeConfig(project)).resolves.toEqual({});
  });
});

describe("question requests", () => {
  it("loads and filters pending questions by session", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([
      {
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
      {
        id: "question-2",
        sessionID: "session-2",
        questions: [
          {
            question: "Ship it?",
            header: "Ship",
            options: [{ label: "Yes", description: "Deploy" }],
          },
        ],
      },
    ])));

    await expect(listOpencodeQuestionRequests(project, "session-1")).resolves.toEqual([
      {
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
    ]);
  });

  it("posts answers and rejections to the question endpoints", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(true)));

    await replyToOpencodeQuestionRequest(project, "question-1", [["Tests"], ["High"]]);
    await rejectOpencodeQuestionRequest(project, "question-1");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:44556/question/question-1/reply",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ answers: [["Tests"], ["High"]] }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:44556/question/question-1/reject",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("revertOpencodeSession", () => {
  it("posts the selected message to the revert endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "session-1",
          directory: "/tmp",
          time: { created: 1 },
          revert: { messageID: "message-2" },
        }),
      ),
    );

    await revertOpencodeSession(project, "session-1", { messageId: "message-2" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:44556/session/session-1/revert",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ messageID: "message-2" }),
      }),
    );
  });
});

describe("unrevertOpencodeSession", () => {
  it("posts to the unrevert endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "session-1",
          directory: "/tmp",
          time: { created: 1 },
        }),
      ),
    );

    await unrevertOpencodeSession(project, "session-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:44556/session/session-1/unrevert",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("forkOpencodeSession", () => {
  it("posts the selected message to the fork endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "session-2",
          parentID: "session-1",
          directory: "/tmp",
          time: { created: 1 },
        }),
      ),
    );

    await forkOpencodeSession(project, "session-1", { messageId: "message-3" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:44556/session/session-1/fork",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ messageID: "message-3" }),
      }),
    );
  });
});
