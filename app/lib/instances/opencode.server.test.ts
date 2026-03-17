// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import type { InstanceRecord } from "~/lib/instances/types";
import { submitOpencodePrompt } from "~/lib/instances/opencode.server";

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
