import type { OpencodeToolPart } from "~/lib/opencode/events";

import { MessagePartToolBash } from "./message-part-tool-bash";
import { MessagePartToolGeneric } from "./message-part-tool-generic";
import { MessagePartToolTask } from "./message-part-tool-task";
import { useOptionalInstanceIdParam } from "./use-optional-instance-id-param";

type MessagePartToolProps = {
  instanceId?: string;
  part: OpencodeToolPart;
};

export function MessagePartTool({ instanceId, part }: MessagePartToolProps) {
  const resolvedInstanceId = useOptionalInstanceIdParam(instanceId);

  if (part.tool === "bash") {
    return <MessagePartToolBash part={part} />;
  }

  if (part.tool === "task") {
    return <MessagePartToolTask instanceId={resolvedInstanceId} part={part} />;
  }

  return <MessagePartToolGeneric instanceId={resolvedInstanceId} part={part} />;
}
