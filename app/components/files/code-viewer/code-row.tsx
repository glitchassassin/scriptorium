import { cn } from "~/lib/cn";

import type { CodeViewerLineSelection, LineKind, ViewLine } from "./types";

function formatLineNumber(line: number | null) {
  return line === null ? "" : String(line);
}

function rowClassName(line: ViewLine) {
  return cn(
    "grid min-w-full w-max items-center",
    {
      "border-t-2 border-t-[var(--color-accent-green)]": line.chunkStartTone === "addition",
      "border-t-2 border-t-[var(--color-accent-red)]": line.chunkStartTone === "deletion",
      "border-b-2 border-b-[var(--color-accent-green)]": line.chunkEndTone === "addition",
      "border-b-2 border-b-[var(--color-accent-red)]": line.chunkEndTone === "deletion",
    },
  );
}

function gutterClassName(kind: LineKind) {
  if (kind === "addition") {
    return "bg-[var(--color-accent-green)] text-white";
  }

  if (kind === "deletion") {
    return "bg-[var(--color-accent-red)] text-white";
  }

  return "text-black/60";
}

function gutterCellClassName(kind: LineKind, align: "center" | "right") {
  const alignment = align === "center" ? "justify-center" : "justify-end";

  return cn("select-none flex h-full w-full items-center self-stretch px-2 text-sm leading-6", alignment, gutterClassName(kind));
}

function markerClassName(kind: LineKind) {
  if (kind === "addition" || kind === "deletion") {
    return "text-white";
  }

  return "text-black/60";
}

function codeCellClassName(kind: LineKind) {
  return cn("whitespace-pre px-2", { "opacity-80": kind === "deletion" });
}

function selectionClassName(isSelectable: boolean, isSelected: boolean) {
  return cn({
    "bg-[color-mix(in_srgb,var(--color-accent-lemon)_28%,white)]": isSelected,
    "cursor-pointer active:bg-[color-mix(in_srgb,var(--color-accent-sky)_14%,white)]": !isSelected && isSelectable,
  });
}

function selectableGutterClassName(isSelectable: boolean) {
  return cn({
    "cursor-pointer active:bg-[color-mix(in_srgb,var(--color-accent-sky)_14%,white)]": isSelectable,
  });
}

type CodeRowProps = {
  line: ViewLine;
  isSelected: boolean;
  markup?: string | null;
  onSelectLine?: (selection: CodeViewerLineSelection) => void;
  rowIndex: number;
  showDualGutters: boolean;
  showLineNumbers: boolean;
  showMarkers: boolean;
  gridTemplateColumns: string;
};

export function CodeRow({
  line,
  isSelected,
  markup,
  onSelectLine,
  rowIndex,
  showDualGutters,
  showLineNumbers,
  showMarkers,
  gridTemplateColumns,
}: CodeRowProps) {
  const isSelectable = Boolean(onSelectLine);
  const className = cn(rowClassName(line), selectionClassName(isSelectable, isSelected));

  function handleClick() {
    if (!onSelectLine) {
      return;
    }

    onSelectLine({ currentFileLine: line.currentFileLine, rowIndex });
  }

  return (
    <div
      aria-selected={isSelected || undefined}
      className={className}
      key={line.key}
      style={{ gridTemplateColumns }}
    >
      {showDualGutters ? (
        <>
          {showMarkers ? (
            <span
              aria-hidden="true"
              className={cn(gutterCellClassName(line.kind, "center"), "font-bold", markerClassName(line.kind), selectableGutterClassName(isSelectable))}
              onClick={handleClick}
            >
              {line.marker || " "}
            </span>
          ) : null}
          <span
            aria-hidden="true"
            className={cn(gutterCellClassName(line.kind, "right"), selectableGutterClassName(line.leftLine !== null && isSelectable))}
            onClick={handleClick}
          >
            {showLineNumbers ? formatLineNumber(line.leftLine) : ""}
          </span>
          <span
            aria-hidden="true"
            className={cn(gutterCellClassName(line.kind, "right"), selectableGutterClassName(line.rightLine !== null && isSelectable))}
            onClick={handleClick}
          >
            {showLineNumbers ? formatLineNumber(line.rightLine) : ""}
          </span>
        </>
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "select-none flex h-full w-full items-center justify-end pr-2 text-right text-sm leading-6 opacity-60",
            !showLineNumbers && "sr-only",
            selectableGutterClassName(line.leftLine !== null && isSelectable),
          )}
          onClick={handleClick}
        >
          {formatLineNumber(showLineNumbers ? line.leftLine : null)}
        </span>
      )}
      <span className={codeCellClassName(line.kind)}>
        {markup ? <code dangerouslySetInnerHTML={{ __html: markup }} /> : <code>{line.content === "" ? "\u00a0" : line.content}</code>}
      </span>
    </div>
  );
}
