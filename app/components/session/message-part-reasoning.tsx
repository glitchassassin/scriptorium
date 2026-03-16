import { useState } from "react";
import { Icon } from "@iconify/react";

import { MessageMarkdown } from "~/components/session/message-markdown";
import type { OpencodeReasoningPart } from "~/lib/opencode/events";

type MessagePartReasoningProps = {
  part: OpencodeReasoningPart;
};

export function MessagePartReasoning({ part }: MessagePartReasoningProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-l-2 border-black pl-2">
      <div className="flex items-center gap-1">
        <button
          aria-label={expanded ? "Collapse reasoning" : "Expand reasoning"}
          className="inline-flex min-h-11 min-w-11 items-center justify-center"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          <Icon className="size-5" icon={expanded ? "mdi:unfold-less-horizontal" : "mdi:unfold-more-horizontal"} />
        </button>
        <p className="text-sm leading-6 opacity-60">Reasoning</p>
      </div>
      {expanded ? <MessageMarkdown text={part.text} variant="reasoning" /> : null}
    </div>
  );
}
