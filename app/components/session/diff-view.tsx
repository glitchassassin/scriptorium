import { useMemo } from "react";

import { getPrismLineMarkup } from "~/components/files/code-viewer/highlighting";
import { CodeRow } from "~/components/files/code-viewer/code-row";
import { detectCodeLanguage } from "~/lib/files/language";
import { parseUnifiedDiff } from "~/lib/files/diff";

type DiffViewProps = {
  diff: string;
  filePath?: string;
};

export function DiffView({ diff, filePath }: DiffViewProps) {
  const lines = useMemo(() => parseUnifiedDiff(diff), [diff]);
  const language = useMemo(() => detectCodeLanguage(filePath ?? ""), [filePath]);
  const highlightedLines = useMemo(
    () => getPrismLineMarkup(lines.map((line) => line.content).join("\n"), language),
    [language, lines],
  );

  if (!lines.length) {
    return null;
  }

  return (
    <div className="space-y-2 pt-2">
      {filePath ? <p className="text-sm leading-6 opacity-60">{filePath}</p> : null}
      <div className="overflow-x-auto text-sm leading-6">
        <div className="inline-block min-w-full w-max align-top">
          {lines.map((line, index) => (
            <CodeRow
              gridTemplateColumns="1.5rem 3.5rem 3.5rem minmax(0, 1fr)"
              isSelected={false}
              key={`${line.kind}-${index}`}
              line={{
                key: `${line.kind}-${index}`,
                kind:
                  line.kind === "addition"
                    ? "addition"
                    : line.kind === "deletion"
                      ? "deletion"
                      : "context",
                content: line.content,
                currentFileLine: line.newLine,
                leftLine: line.oldLine,
                rightLine: line.newLine,
                marker: line.marker,
                chunkStartTone: null,
                chunkEndTone: null,
              }}
              markup={highlightedLines?.[index] ?? null}
              rowIndex={index}
              showDualGutters={true}
              showLineNumbers={true}
              showMarkers={true}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
