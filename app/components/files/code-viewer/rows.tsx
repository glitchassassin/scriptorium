import type { RefObject } from "react";

import { CodeRow } from "~/components/files/code-viewer/code-row";
import type { CodeViewerLineSelection, CodeViewerProps, ViewLine } from "~/components/files/code-viewer/types";
import { cn } from "~/lib/cn";

import styles from "../code-viewer.module.css";

type CodeViewerRowsProps = {
  highlightedLines: Array<string | null> | null;
  lines: ViewLine[];
  mode?: CodeViewerProps["mode"];
  onSelectLine?: (selection: CodeViewerLineSelection) => void;
  scrollPaneRef: RefObject<HTMLDivElement | null>;
  selectedRowRange: { start: number; end: number } | null;
  showDualGutters: boolean;
  showLineNumbers: boolean;
  showDiffMarkers: boolean;
};

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

function isRowInRange(index: number, range: { start: number; end: number } | null) {
  if (!range) {
    return false;
  }

  return index >= range.start && index <= range.end;
}

export function CodeViewerRows({
  highlightedLines,
  lines,
  mode = "text",
  onSelectLine,
  scrollPaneRef,
  selectedRowRange,
  showDualGutters,
  showLineNumbers,
  showDiffMarkers,
}: CodeViewerRowsProps) {
  const normalizedSelectedRange = selectedRowRange
    ? {
        start: Math.min(selectedRowRange.start, selectedRowRange.end),
        end: Math.max(selectedRowRange.start, selectedRowRange.end),
      }
    : null;
  const leftLineNumberWidth = buildLineNumberColumnWidth(lines, "left");
  const rightLineNumberWidth = buildLineNumberColumnWidth(lines, "right");
  const showMarkers = mode === "diff" && showDiffMarkers;
  const gridTemplateColumns = showDualGutters
    ? showMarkers
      ? `1.5rem ${leftLineNumberWidth} ${rightLineNumberWidth} minmax(0, 1fr)`
      : `${leftLineNumberWidth} ${rightLineNumberWidth} minmax(0, 1fr)`
    : `${leftLineNumberWidth} minmax(0, 1fr)`;

  return (
    <div ref={scrollPaneRef} className={cn(styles.scrollPane, "min-h-0 min-w-0 flex-1 overflow-auto pr-6")}>
      <div className="inline-block min-w-full w-max align-top">
        {lines.map((line, index) => (
          <CodeRow
            key={line.key}
            gridTemplateColumns={gridTemplateColumns}
            isSelected={isRowInRange(index, normalizedSelectedRange)}
            line={line}
            markup={highlightedLines?.[index] ?? null}
            onSelectLine={onSelectLine}
            rowIndex={index}
            showDualGutters={showDualGutters}
            showLineNumbers={showLineNumbers}
            showMarkers={showMarkers}
          />
        ))}
      </div>
    </div>
  );
}
