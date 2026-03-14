import type { OpencodeToolPart } from "~/lib/opencode/events";

type MessagePartToolProps = {
  part: OpencodeToolPart;
};

export function MessagePartTool({ part }: MessagePartToolProps) {
  return (
    <div className="pt-2 text-sm leading-6">
      <p className="font-bold">Tool: {part.tool}</p>
      <p className="opacity-60">{part.state.status}</p>
    </div>
  );
}
