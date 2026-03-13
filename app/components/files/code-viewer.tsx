import { useMemo } from "react";

import { getPrismLineMarkup } from "~/components/files/code-viewer/highlighting";
import { CodeRow } from "~/components/files/code-viewer/code-row";
import { buildChangeMarkers, buildDiffLines, buildTextLines } from "~/components/files/code-viewer/model";
import { ScrollIndicator } from "~/components/files/code-viewer/scroll-indicator";
import type { CodeViewerProps } from "~/components/files/code-viewer/types";
import { useScrollIndicator } from "~/components/files/code-viewer/use-scroll-indicator";
import { detectCodeLanguage } from "~/lib/files/language";

export function CodeViewer({
  content,
  diffContent,
  diffSide = "new",
  fileName,
  language,
  mode = "text",
  showLineNumbers = true,
  showDiffMarkers = true,
}: CodeViewerProps) {
  const detectedLanguage = useMemo(() => language ?? detectCodeLanguage(fileName ?? ""), [fileName, language]);
  const lines = useMemo(() => {
    if (mode === "diff" && diffContent) {
      return buildDiffLines(content, diffContent, diffSide);
    }

    return buildTextLines(content);
  }, [content, diffContent, diffSide, mode]);
  const changeMarkers = useMemo(() => (mode === "diff" ? buildChangeMarkers(lines) : []), [lines, mode]);
  const highlightedLines = useMemo(
    () => getPrismLineMarkup(lines.map((line) => line.content).join("\n"), detectedLanguage),
    [detectedLanguage, lines],
  );

  const showMarkers = mode === "diff" && showDiffMarkers;
  const showDualGutters = mode === "diff";
  const gridTemplateColumns = showDualGutters
    ? showMarkers
      ? "1.5rem 3.5rem 3.5rem minmax(0, 1fr)"
      : "3.5rem 3.5rem minmax(0, 1fr)"
    : "3.5rem minmax(0, 1fr)";
  const {
    scrollPaneRef,
    indicatorRailRef,
    indicatorThumbRef,
    handleIndicatorClick,
    handleIndicatorThumbPointerDown,
  } = useScrollIndicator([lines]);

  return (
    <section className="code-viewer relative flex min-h-0 min-w-0 flex-1 bg-white text-sm leading-6">
      <div className="relative flex min-h-0 min-w-0 flex-1">
        <div ref={scrollPaneRef} className="code-viewer-scroll-pane min-h-0 min-w-0 flex-1 overflow-auto pr-6">
          <div className="inline-block min-w-full w-max align-top">
            {lines.map((line, index) => (
              <CodeRow
                key={line.key}
                line={line}
                markup={highlightedLines?.[index] ?? null}
                showDualGutters={showDualGutters}
                showLineNumbers={showLineNumbers}
                showMarkers={showMarkers}
                gridTemplateColumns={gridTemplateColumns}
              />
            ))}
          </div>
        </div>
        <ScrollIndicator
          mode={mode}
          changeMarkers={changeMarkers}
          indicatorRailRef={indicatorRailRef}
          indicatorThumbRef={indicatorThumbRef}
          onRailClick={handleIndicatorClick}
          onThumbPointerDown={handleIndicatorThumbPointerDown}
        />
      </div>
    </section>
  );
}
