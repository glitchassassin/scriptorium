import type { OpencodeMessagePart } from "~/lib/opencode/events";

import { MessagePartAgent } from "./message-part-agent";
import { MessagePartCompaction } from "./message-part-compaction";
import { MessagePartFile } from "./message-part-file";
import { MessagePartPatch } from "./message-part-patch";
import { MessagePartReasoning } from "./message-part-reasoning";
import { MessagePartRetry } from "./message-part-retry";
import { MessagePartSnapshot } from "./message-part-snapshot";
import { MessagePartSubtask } from "./message-part-subtask";
import { MessagePartText } from "./message-part-text";
import { MessagePartTool } from "./message-part-tool";

type MessagePartViewProps = {
  part: OpencodeMessagePart;
  role: "user" | "assistant";
};

export function MessagePartView({ part, role }: MessagePartViewProps) {
  if (part.type === "text") {
    return <MessagePartText part={part} role={role} />;
  }

  if (part.type === "reasoning") {
    return <MessagePartReasoning part={part} />;
  }

  if (role === "user") {
    return null;
  }

  if (part.type === "tool") {
    return <MessagePartTool part={part} />;
  }

  if (part.type === "file") {
    return <MessagePartFile part={part} />;
  }

  if (part.type === "step-start" || part.type === "step-finish") {
    return null;
  }

  if (part.type === "agent") {
    return <MessagePartAgent part={part} />;
  }

  if (part.type === "subtask") {
    return <MessagePartSubtask part={part} />;
  }

  if (part.type === "retry") {
    return <MessagePartRetry part={part} />;
  }

  if (part.type === "patch") {
    return <MessagePartPatch part={part} />;
  }

  if (part.type === "snapshot") {
    return <MessagePartSnapshot />;
  }

  if (part.type === "compaction") {
    return <MessagePartCompaction />;
  }

  return null;
}
