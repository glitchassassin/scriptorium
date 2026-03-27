import type { OpencodeToolPart } from "~/lib/opencode/events";

import { MessagePartToolBash } from "./message-part-tool-bash";
import { MessagePartToolGeneric } from "./message-part-tool-generic";
import { MessagePartToolTask } from "./message-part-tool-task";

type MessagePartToolProps = {
  instanceId?: string;
  part: OpencodeToolPart;
};

export function MessagePartTool({ instanceId, part }: MessagePartToolProps) {
  if (part.tool === "bash") {
    return <MessagePartToolBash part={part} />;
  }

  if (part.tool === "task") {
    return <MessagePartToolTask instanceId={instanceId} part={part} />;
  }

  return <MessagePartToolGeneric instanceId={instanceId} part={part} />;
}
