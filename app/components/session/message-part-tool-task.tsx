import { Link } from "react-router";
import { Icon } from "@iconify/react";

import type { OpencodeToolPart } from "~/lib/opencode/events";

type MessagePartToolTaskProps = {
  instanceId?: string;
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

export function MessagePartToolTask({ instanceId, part }: MessagePartToolTaskProps) {
  const id = getSessionId(part);
  const label = getLabel(part);

  return (
    <div className="pt-2 text-sm leading-6">
      <p className="opacity-60">Task ({part.state.status})</p>
      {id && instanceId ? (
        <Link
          className="inline-flex min-h-11 items-center gap-1 font-bold underline underline-offset-4"
          to={`/instances/${instanceId}/sessions/${id}`}
        >
          <span>{label}</span>
          <Icon className="size-4" icon="mdi:arrow-right" />
        </Link>
      ) : (
        <p className="inline-flex min-h-11 items-center gap-1 font-bold">
          <span>{label}</span>
          <Icon className="size-4" icon="mdi:arrow-right" />
        </p>
      )}
    </div>
  );
}
