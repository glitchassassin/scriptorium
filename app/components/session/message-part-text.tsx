import type { OpencodeTextPart } from "~/lib/opencode/events";

import { MessageMarkdown } from "~/components/session/message-markdown";

type MessagePartTextProps = {
  part: OpencodeTextPart;
  role?: "user" | "assistant";
};

export function MessagePartText({ part, role }: MessagePartTextProps) {
  if (part.ignored || (role === "user" && part.synthetic)) {
    return null;
  }

  if (role === "assistant") {
    return <MessageMarkdown text={part.text} />;
  }

  return <p className="whitespace-pre-wrap break-words text-base leading-7">{part.text}</p>;
}
