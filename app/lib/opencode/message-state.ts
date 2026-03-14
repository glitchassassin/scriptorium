import type {
  OpencodeMessageInfo,
  OpencodeMessagePart,
  OpencodeMessageWithParts,
} from "~/lib/opencode/events";

function sortMessages(messages: OpencodeMessageWithParts[]) {
  return [...messages].sort((left, right) => left.info.time.created - right.info.time.created);
}

export function upsertMessage(
  messages: OpencodeMessageWithParts[],
  info: OpencodeMessageInfo,
) {
  const current = messages.find((message) => message.info.id === info.id);

  if (current) {
    return sortMessages(
      messages.map((message) => (message.info.id === info.id ? { ...message, info } : message)),
    );
  }

  return sortMessages([...messages, { info, parts: [] }]);
}

export function removeMessage(
  messages: OpencodeMessageWithParts[],
  messageId: string,
) {
  return messages.filter((message) => message.info.id !== messageId);
}

export function upsertMessagePart(
  messages: OpencodeMessageWithParts[],
  part: OpencodeMessagePart,
) {
  return messages.map((message) => {
    if (message.info.id !== part.messageID) {
      return message;
    }

    const parts = message.parts.some((currentPart) => currentPart.id === part.id)
      ? message.parts.map((currentPart) => (currentPart.id === part.id ? part : currentPart))
      : [...message.parts, part];

    return { ...message, parts };
  });
}

export function removeMessagePart(
  messages: OpencodeMessageWithParts[],
  messageId: string,
  partId: string,
) {
  return messages.map((message) => {
    if (message.info.id !== messageId) {
      return message;
    }

    return {
      ...message,
      parts: message.parts.filter((part) => part.id !== partId),
    };
  });
}

export function applyMessagePartDelta(
  messages: OpencodeMessageWithParts[],
  messageId: string,
  partId: string,
  field: string,
  delta: string,
) {
  return messages.map((message) => {
    if (message.info.id !== messageId) {
      return message;
    }

    return {
      ...message,
      parts: message.parts.map((part) => {
        if (part.id !== partId) {
          return part;
        }

        if ((part.type !== "text" && part.type !== "reasoning") || field !== "text") {
          return part;
        }

        return {
          ...part,
          text: part.text + delta,
        };
      }),
    };
  });
}
