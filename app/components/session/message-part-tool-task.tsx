import { Link } from "react-router";
import { Icon } from "@iconify/react";

import type { OpencodeToolPart } from "~/lib/opencode/events";

type MessagePartToolTaskProps = {
  projectId?: string;
  part: OpencodeToolPart;
};

function getText(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function getSessionId(part: OpencodeToolPart) {
  const metadata = "metadata" in part.state ? part.state.metadata : undefined;
  return getText(metadata?.sessionId);
}

function getLabel(part: OpencodeToolPart) {
  return getText(part.state.input.description) || getSessionId(part) || "Task session";
}

export function MessagePartToolTask({ projectId, part }: MessagePartToolTaskProps) {
  const id = getSessionId(part);
  const label = getLabel(part);

  return (
    <div className="pt-2 text-sm leading-6">
      <p className="opacity-60">Task ({part.state.status})</p>
      {id && projectId ? (
        <Link
          className="flex min-h-11 min-w-0 items-start gap-1 font-bold underline underline-offset-4"
          to={`/projects/${projectId}/sessions/${id}`}
        >
          <span className="min-w-0 break-words">{label}</span>
          <Icon className="mt-1 size-4 shrink-0" icon="mdi:arrow-right" />
        </Link>
      ) : (
        <p className="flex min-h-11 min-w-0 items-start gap-1 font-bold">
          <span className="min-w-0 break-words">{label}</span>
          <Icon className="mt-1 size-4 shrink-0" icon="mdi:arrow-right" />
        </p>
      )}
    </div>
  );
}
