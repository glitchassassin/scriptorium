import type { OpencodeToolPart } from "~/lib/opencode/events";

import { MessagePartToolBash } from "./message-part-tool-bash";
import { MessagePartToolGeneric } from "./message-part-tool-generic";

type MessagePartToolProps = {
  part: OpencodeToolPart;
};

export function MessagePartTool({ part }: MessagePartToolProps) {
  if (part.tool === "bash") {
    return <MessagePartToolBash part={part} />;
  }

  return <MessagePartToolGeneric part={part} />;
}
