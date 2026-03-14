import type { OpencodeTextPart } from "~/lib/opencode/events";

type MessagePartTextProps = {
  part: OpencodeTextPart;
};

export function MessagePartText({ part }: MessagePartTextProps) {
  if (part.ignored) {
    return null;
  }

  return <p className="whitespace-pre-wrap break-words text-base leading-7">{part.text}</p>;
}
