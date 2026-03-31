// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import { listOpencodeMessagePageClient } from "~/lib/projects/opencode.client";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("listOpencodeMessagePageClient", () => {
  it("loads message pages through the project proxy", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([
      {
        info: {
          id: "message-1",
          sessionID: "session-1",
          role: "user",
          time: { created: 1 },
        },
        parts: [],
      },
    ]), {
      headers: {
        "X-Next-Cursor": "cursor-2",
      },
    }));

    await expect(listOpencodeMessagePageClient("project-1", "session-1", { before: "cursor-1", limit: 20 })).resolves.toEqual({
      hasMore: true,
      items: [
        {
          info: {
            id: "message-1",
            sessionID: "session-1",
            role: "user",
            time: { created: 1 },
          },
          parts: [],
        },
      ],
      nextCursor: "cursor-2",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/projects/project-1/proxy/session/session-1/message?limit=20&before=cursor-1",
    );
  });
});
