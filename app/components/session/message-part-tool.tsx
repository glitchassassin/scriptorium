import type { OpencodeToolPart } from "~/lib/opencode/events";

import { MessagePartToolBash } from "./message-part-tool-bash";
import { MessagePartToolGeneric } from "./message-part-tool-generic";
import { MessagePartToolTask } from "./message-part-tool-task";
import { useOptionalProjectIdParam } from "./use-optional-project-id-param";

type MessagePartToolProps = {
  projectId?: string;
  part: OpencodeToolPart;
};

export function MessagePartTool({ projectId, part }: MessagePartToolProps) {
  const resolvedProjectId = useOptionalProjectIdParam(projectId);

  if (part.tool === "bash") {
    return <MessagePartToolBash part={part} />;
  }

  if (part.tool === "task") {
    return <MessagePartToolTask part={part} projectId={resolvedProjectId} />;
  }

  return <MessagePartToolGeneric part={part} projectId={resolvedProjectId} />;
}
