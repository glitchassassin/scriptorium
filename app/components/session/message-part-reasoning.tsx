import type { OpencodeReasoningPart } from "~/lib/opencode/events";

type MessagePartReasoningProps = {
  part: OpencodeReasoningPart;
};

export function MessagePartReasoning({ part }: MessagePartReasoningProps) {
  return (
    <details className="pt-2">
      <summary className="cursor-pointer text-sm uppercase tracking-[0.08em]">Reasoning</summary>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 opacity-80">{part.text}</p>
    </details>
  );
}
