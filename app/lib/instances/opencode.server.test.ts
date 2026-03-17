// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import type { InstanceRecord } from "~/lib/instances/types";
import {
  forkOpencodeSession,
  revertOpencodeSession,
  submitOpencodePrompt,
  unrevertOpencodeSession,
} from "~/lib/instances/opencode.server";

const instance: InstanceRecord = {
  id: "instance-1",
  name: "test",
  directory: "/tmp",
  port: 44556,
  status: "running",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  lastStartedAt: null,
  lastExitAt: null,
  lastError: null,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("submitOpencodePrompt", () => {
  it("sends agent only when selected", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));

    await submitOpencodePrompt(instance, "session-1", { text: "Hello" });
    await submitOpencodePrompt(instance, "session-1", { text: "Hello", agent: "analysis" });

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
      ],
      agent: "analysis",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(`http://127.0.0.1:${instance.port}/session/session-1/prompt_async`);
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

    await revertOpencodeSession(instance, "session-1", { messageId: "message-2" });

    expect(fetchMock).toHaveBeenCalledWith(
      `http://127.0.0.1:${instance.port}/session/session-1/revert`,
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

    await unrevertOpencodeSession(instance, "session-1");

    expect(fetchMock).toHaveBeenCalledWith(
      `http://127.0.0.1:${instance.port}/session/session-1/unrevert`,
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

    await forkOpencodeSession(instance, "session-1", { messageId: "message-3" });

    expect(fetchMock).toHaveBeenCalledWith(
      `http://127.0.0.1:${instance.port}/session/session-1/fork`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ messageID: "message-3" }),
      }),
    );
  });
});
