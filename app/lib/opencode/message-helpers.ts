import type { OpencodeMessageWithParts, OpencodeSessionRevert } from "~/lib/opencode/events";

export function getUserMessageText(message: OpencodeMessageWithParts) {
  if (message.info.role !== "user") {
    return null;
  }

  const textPart = message.parts.find(
    (part): part is Extract<OpencodeMessageWithParts["parts"][number], { type: "text" }> =>
      part.type === "text" && !part.ignored && !part.synthetic,
  );
  return textPart?.text.trim() || null;
}

export function partitionMessagesByRevert(
  messages: OpencodeMessageWithParts[],
  revert: OpencodeSessionRevert | null | undefined,
) {
  if (!revert) {
    return {
      visibleMessages: messages,
      revertedMessages: [] as OpencodeMessageWithParts[],
    };
  }

  const boundaryIndex = messages.findIndex((message) => message.info.id === revert.messageID);

  if (boundaryIndex < 0) {
    return {
      visibleMessages: messages,
      revertedMessages: [] as OpencodeMessageWithParts[],
    };
  }

  return {
    visibleMessages: messages.slice(0, boundaryIndex),
    revertedMessages: messages.slice(boundaryIndex),
  };
}
