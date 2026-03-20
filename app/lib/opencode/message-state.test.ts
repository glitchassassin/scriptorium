import { describe, expect, it } from "vitest";

import type { OpencodeMessageWithParts } from "~/lib/opencode/events";
import { mergeMessages } from "~/lib/opencode/message-state";

function message(id: string, created: number, text: string): OpencodeMessageWithParts {
  return {
    info: {
      id,
      sessionID: "session-1",
      role: "assistant",
      parentID: "parent-1",
      time: { created },
    },
    parts: [
      {
        id: `${id}-part`,
        sessionID: "session-1",
        messageID: id,
        type: "text",
        text,
      },
    ],
  };
}

describe("mergeMessages", () => {
  it("adds missing history without replacing newer in-memory messages", () => {
    const currentMessages = [message("message-2", 2, "newer live text"), message("message-3", 3, "latest")];
    const nextMessages = [message("message-1", 1, "older"), message("message-2", 2, "stale server text")];

    expect(mergeMessages(currentMessages, nextMessages)).toEqual([
      message("message-1", 1, "older"),
      message("message-2", 2, "newer live text"),
      message("message-3", 3, "latest"),
    ]);
  });
});
