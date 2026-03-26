import { useEffect, useMemo, useState, type RefObject } from "react";

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

const DEFAULT_VIEWPORT_HEIGHT_PX = 600;
const OVERSCAN_ROWS = 8;
const ROW_HEIGHT_PX = 24;
const VIRTUALIZATION_MIN_LINE_COUNT = 200;

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
  const shouldVirtualize = lines.length >= VIRTUALIZATION_MIN_LINE_COUNT;
  const [{ scrollTop, viewportHeight }, setViewport] = useState({
    scrollTop: 0,
    viewportHeight: DEFAULT_VIEWPORT_HEIGHT_PX,
  });

  useEffect(() => {
    if (!shouldVirtualize) {
      return;
    }

    const scrollEl = scrollPaneRef.current;

    if (!scrollEl) {
      return;
    }

    const updateViewport = () => {
      const nextScrollTop = scrollEl.scrollTop;
      const nextViewportHeight = scrollEl.clientHeight || DEFAULT_VIEWPORT_HEIGHT_PX;

      setViewport((current) => {
        if (current.scrollTop === nextScrollTop && current.viewportHeight === nextViewportHeight) {
          return current;
        }

        return {
          scrollTop: nextScrollTop,
          viewportHeight: nextViewportHeight,
        };
      });
    };

    updateViewport();
    scrollEl.addEventListener("scroll", updateViewport, { passive: true });

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            updateViewport();
          });

    resizeObserver?.observe(scrollEl);

    return () => {
      scrollEl.removeEventListener("scroll", updateViewport);
      resizeObserver?.disconnect();
    };
  }, [scrollPaneRef, shouldVirtualize]);

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
  const visibleRowBounds = useMemo(() => {
    if (!shouldVirtualize) {
      return { start: 0, end: lines.length };
    }

    const start = Math.max(Math.floor(scrollTop / ROW_HEIGHT_PX) - OVERSCAN_ROWS, 0);
    const end = Math.min(
      Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT_PX) + OVERSCAN_ROWS,
      lines.length,
    );

    return { start, end };
  }, [lines.length, scrollTop, shouldVirtualize, viewportHeight]);
  const topSpacerHeight = shouldVirtualize ? visibleRowBounds.start * ROW_HEIGHT_PX : 0;
  const bottomSpacerHeight = shouldVirtualize
    ? Math.max(lines.length - visibleRowBounds.end, 0) * ROW_HEIGHT_PX
    : 0;
  const visibleLines = shouldVirtualize
    ? lines.slice(visibleRowBounds.start, visibleRowBounds.end)
    : lines;

  return (
    <div
      ref={scrollPaneRef}
      className={cn(styles.scrollPane, "min-h-0 min-w-0 flex-1 overflow-auto pr-6")}
      data-testid="code-viewer-scroll-pane"
    >
      <div className="inline-block min-w-full w-max align-top">
        {topSpacerHeight > 0 ? <div aria-hidden="true" style={{ height: `${topSpacerHeight}px` }} /> : null}
        {visibleLines.map((line, index) => {
          const rowIndex = visibleRowBounds.start + index;

          return (
            <CodeRow
              key={line.key}
              gridTemplateColumns={gridTemplateColumns}
              isSelected={isRowInRange(rowIndex, normalizedSelectedRange)}
              line={line}
              markup={highlightedLines?.[rowIndex] ?? null}
              onSelectLine={onSelectLine}
              rowIndex={rowIndex}
              showDualGutters={showDualGutters}
              showLineNumbers={showLineNumbers}
              showMarkers={showMarkers}
            />
          );
        })}
        {bottomSpacerHeight > 0 ? <div aria-hidden="true" style={{ height: `${bottomSpacerHeight}px` }} /> : null}
      </div>
    </div>
  );
}
