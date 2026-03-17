import { describe, expect, it } from "vitest";

import { getUserMessageText, partitionMessagesByRevert } from "~/lib/opencode/message-helpers";
import type { OpencodeMessageWithParts } from "~/lib/opencode/events";

const userMessage = (id: string, text: string): OpencodeMessageWithParts => ({
  info: {
    id,
    sessionID: "session-1",
    role: "user",
    time: { created: Number(id.replace(/\D/g, "")) || 1 },
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
});

const assistantMessage = (id: string): OpencodeMessageWithParts => ({
  info: {
    id,
    sessionID: "session-1",
    role: "assistant",
    parentID: "message-1",
    time: { created: Number(id.replace(/\D/g, "")) || 1 },
  },
  parts: [],
});

describe("getUserMessageText", () => {
  it("returns the first visible user text", () => {
    expect(getUserMessageText(userMessage("message-1", "Hello there"))).toBe("Hello there");
    expect(getUserMessageText(assistantMessage("message-2"))).toBeNull();
  });
});

describe("partitionMessagesByRevert", () => {
  it("splits messages around the revert boundary", () => {
    const messages = [
      userMessage("message-1", "First"),
      assistantMessage("message-2"),
      userMessage("message-3", "Second"),
      assistantMessage("message-4"),
    ];

    const result = partitionMessagesByRevert(messages, { messageID: "message-3" });

    expect(result.visibleMessages.map((message) => message.info.id)).toEqual(["message-1", "message-2"]);
    expect(result.revertedMessages.map((message) => message.info.id)).toEqual(["message-3", "message-4"]);
  });
});
