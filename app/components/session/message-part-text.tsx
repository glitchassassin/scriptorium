import type { OpencodeTextPart } from "~/lib/opencode/events";

type MessagePartTextProps = {
  part: OpencodeTextPart;
  role?: "user" | "assistant";
};

export function MessagePartText({ part, role }: MessagePartTextProps) {
  if (part.ignored || (role === "user" && part.synthetic)) {
    return null;
  }

  return <p className="whitespace-pre-wrap break-words text-base leading-7">{part.text}</p>;
}
