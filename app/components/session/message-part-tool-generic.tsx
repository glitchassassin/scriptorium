import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";

import { CodeViewer } from "~/components/files/code-viewer";
import { DiffView } from "~/components/session/diff-view";
import type { OpencodeToolPart } from "~/lib/opencode/events";

type MessagePartToolGenericProps = {
  part: OpencodeToolPart;
};

function getToolTitle(part: OpencodeToolPart) {
  if ((part.state.status === "running" || part.state.status === "completed") && part.state.title) {
    return part.state.title === part.tool ? part.tool : `${part.tool}: ${part.state.title}`;
  }

  return part.tool;
}

function getToolDiff(part: OpencodeToolPart) {
  const metadata = "metadata" in part.state ? part.state.metadata : undefined;
  const diff = metadata?.diff;

  if (typeof diff === "string") {
    return diff;
  }

  if (part.tool !== "write") {
    return null;
  }

  const content = part.state.input.content;

  if (typeof content !== "string") {
    return null;
  }

  const lines = content.split("\n");
  return `@@ -0,0 +1,${lines.length} @@\n${lines.map((line) => `+${line}`).join("\n")}`;
}

function getFilePath(part: OpencodeToolPart) {
  const metadata = "metadata" in part.state ? part.state.metadata : undefined;

  if (typeof metadata?.filepath === "string") {
    return metadata.filepath;
  }

  const filePath = part.state.input.filePath;
  return typeof filePath === "string" ? filePath : undefined;
}

function renderObject(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function MessagePartToolGeneric({ part }: MessagePartToolGenericProps) {
  const [expanded, setExpanded] = useState(false);
  const diff = useMemo(() => getToolDiff(part), [part]);
  const filePath = useMemo(() => getFilePath(part), [part]);
  const title = useMemo(() => getToolTitle(part), [part]);

  return (
    <div className="border-l-2 border-black pl-2">
      <div className="flex items-center gap-1">
        <button
          aria-label={expanded ? "Collapse tool details" : "Expand tool details"}
          className="inline-flex min-h-11 min-w-11 items-center justify-center"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          <Icon className="size-5" icon={expanded ? "mdi:unfold-less-horizontal" : "mdi:unfold-more-horizontal"} />
        </button>
        <p className="text-sm leading-6 opacity-60">
          {title} ({part.state.status})
        </p>
      </div>
      {expanded ? (
        <div className="space-y-2 text-sm leading-6">
          {diff ? <DiffView diff={diff} filePath={filePath} /> : null}
          {part.state.input ? (
            <div className="space-y-1">
              <p className="uppercase tracking-[0.08em] opacity-60">Input</p>
              <CodeViewer
                content={renderObject(part.state.input)}
                language="json"
                showDiffMarkers={false}
                showScrollIndicator={false}
              />
            </div>
          ) : null}
          {part.state.status === "completed" ? (
            <div className="space-y-1">
              <p className="uppercase tracking-[0.08em] opacity-60">Output</p>
              <pre className="whitespace-pre-wrap break-words">
                <code>{part.state.output}</code>
              </pre>
            </div>
          ) : null}
          {part.state.status === "error" ? (
            <div className="space-y-1">
              <p className="uppercase tracking-[0.08em] opacity-60">Error</p>
              <pre className="whitespace-pre-wrap break-words">
                <code>{part.state.error}</code>
              </pre>
            </div>
          ) : null}
          {part.state.status === "completed" && part.state.attachments?.length ? (
            <div className="space-y-1">
              <p className="uppercase tracking-[0.08em] opacity-60">Attachments</p>
              <ul className="space-y-1">
                {part.state.attachments.map((attachment) => (
                  <li key={attachment.id} className="opacity-60">
                    {attachment.filename ?? attachment.url}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
