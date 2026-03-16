import { useMemo } from "react";

import { getPrismLineMarkup } from "~/components/files/code-viewer/highlighting";
import { CodeRow } from "~/components/files/code-viewer/code-row";
import { buildChangeMarkers, buildDiffLines, buildTextLines } from "~/components/files/code-viewer/model";
import { ScrollIndicator } from "~/components/files/code-viewer/scroll-indicator";
import type { CodeViewerProps } from "~/components/files/code-viewer/types";
import { useScrollIndicator } from "~/components/files/code-viewer/use-scroll-indicator";
import { detectCodeLanguage } from "~/lib/files/language";

import styles from "./code-viewer.module.css";

function countDigits(value: number | null) {
  if (!value || value < 1) {
    return 1;
  }

  return String(value).length;
}

function buildLineNumberColumnWidth(lines: Array<{ leftLine: number | null; rightLine: number | null }>, side: "left" | "right") {
  const maxDigits = lines.reduce((currentMax, line) => {
    const value = side === "left" ? line.leftLine : line.rightLine;
    return Math.max(currentMax, countDigits(value));
  }, 1);

  return `calc(${maxDigits}ch + 1rem)`;
}

export function CodeViewer({
  content,
  diffContent,
  diffSide = "new",
  fileName,
  language,
  mode = "text",
  showLineNumbers = true,
  showDiffMarkers = true,
  showScrollIndicator = true,
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
  const leftLineNumberWidth = useMemo(() => buildLineNumberColumnWidth(lines, "left"), [lines]);
  const rightLineNumberWidth = useMemo(() => buildLineNumberColumnWidth(lines, "right"), [lines]);
  const gridTemplateColumns = showDualGutters
    ? showMarkers
      ? `1.5rem ${leftLineNumberWidth} ${rightLineNumberWidth} minmax(0, 1fr)`
      : `${leftLineNumberWidth} ${rightLineNumberWidth} minmax(0, 1fr)`
    : `${leftLineNumberWidth} minmax(0, 1fr)`;
  const {
    scrollPaneRef,
    indicatorRailRef,
    indicatorThumbRef,
    handleIndicatorClick,
    handleIndicatorThumbPointerDown,
  } = useScrollIndicator([lines]);

  return (
    <section className={`${styles.root} relative flex min-h-0 min-w-0 flex-1 bg-white text-sm leading-6`}>
      <div className="relative flex min-h-0 min-w-0 flex-1">
        <div ref={scrollPaneRef} className={`${styles.scrollPane} min-h-0 min-w-0 flex-1 overflow-auto pr-6`}>
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
        {showScrollIndicator ? (
          <ScrollIndicator
            mode={mode}
            changeMarkers={changeMarkers}
            indicatorRailRef={indicatorRailRef}
            indicatorThumbRef={indicatorThumbRef}
            onRailClick={handleIndicatorClick}
            onThumbPointerDown={handleIndicatorThumbPointerDown}
          />
        ) : null}
      </div>
    </section>
  );
}
