import { useState } from "react";
import { Icon } from "@iconify/react";

import { BashViewer } from "~/components/session/bash-viewer";
import type { OpencodeToolPart } from "~/lib/opencode/events";

type MessagePartToolBashProps = {
  part: OpencodeToolPart;
};

function getCommand(part: OpencodeToolPart) {
  const command = part.state.input.command;
  return typeof command === "string" ? command : "";
}

export function MessagePartToolBash({ part }: MessagePartToolBashProps) {
  const [expanded, setExpanded] = useState(false);
  const command = getCommand(part);
  const isRunning = part.state.status === "pending" || part.state.status === "running";
  const output = part.state.status === "completed" ? part.state.output : "";
  const error = part.state.status === "error" ? part.state.error : "";

  return (
    <div className="border-l-2 border-black pl-2">
      <div className="flex min-w-0 items-start gap-1">
        <button
          aria-label={expanded ? "Collapse bash output" : "Expand bash output"}
          className="inline-flex min-h-11 min-w-11 items-center justify-center"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          <Icon className="size-5" icon={expanded ? "mdi:unfold-less-horizontal" : "mdi:unfold-more-horizontal"} />
        </button>
        <p className="min-w-0 break-words pt-2 text-sm leading-6 opacity-60">
          bash: {command || "(no command)"} ({isRunning ? "running" : part.state.status})
        </p>
      </div>
      {expanded ? (
        <div className="space-y-1">
          <BashViewer content={output || (isRunning ? "Running..." : "No output.")} />
          {error ? <BashViewer className="whitespace-pre-wrap break-words text-sm leading-6 opacity-60" content={error} /> : null}
        </div>
      ) : null}
    </div>
  );
}
