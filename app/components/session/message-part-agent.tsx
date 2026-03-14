import type { OpencodeAgentPart } from "~/lib/opencode/events";

type MessagePartAgentProps = {
  part: OpencodeAgentPart;
};

export function MessagePartAgent({ part }: MessagePartAgentProps) {
  return <p className="pt-2 text-sm leading-6 opacity-60">Agent: {part.name}</p>;
}
