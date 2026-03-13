import type { LineKind, ViewLine } from "./types";

function formatLineNumber(line: number | null) {
  return line === null ? "" : String(line);
}

function rowClassName(line: ViewLine) {
  const classes = [
    "grid min-h-9 min-w-full w-max items-center",
    line.chunkStartTone === "addition" ? "border-t-2 border-t-[var(--color-accent-green)]" : "",
    line.chunkStartTone === "deletion" ? "border-t-2 border-t-[var(--color-accent-red)]" : "",
    line.chunkEndTone === "addition" ? "border-b-2 border-b-[var(--color-accent-green)]" : "",
    line.chunkEndTone === "deletion" ? "border-b-2 border-b-[var(--color-accent-red)]" : "",
  ];

  return classes.filter(Boolean).join(" ");
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

  return `flex min-h-6 items-center ${alignment} self-stretch px-2 text-sm leading-6 ${gutterClassName(kind)}`;
}

function markerClassName(kind: LineKind) {
  if (kind === "addition" || kind === "deletion") {
    return "text-white";
  }

  return "text-black/60";
}

function codeCellClassName(kind: LineKind) {
  return `whitespace-pre px-2 ${kind === "deletion" ? "opacity-80" : ""}`;
}

type CodeRowProps = {
  line: ViewLine;
  markup?: string | null;
  showDualGutters: boolean;
  showLineNumbers: boolean;
  showMarkers: boolean;
  gridTemplateColumns: string;
};

export function CodeRow({
  line,
  markup,
  showDualGutters,
  showLineNumbers,
  showMarkers,
  gridTemplateColumns,
}: CodeRowProps) {
  return (
    <div className={rowClassName(line)} key={line.key} style={{ gridTemplateColumns }}>
      {showDualGutters ? (
        <>
          {showMarkers ? (
            <span
              aria-hidden="true"
              className={`${gutterCellClassName(line.kind, "center")} font-bold ${markerClassName(line.kind)}`}
            >
              {line.marker || " "}
            </span>
          ) : null}
          <span aria-hidden="true" className={gutterCellClassName(line.kind, "right")}>
            {showLineNumbers ? formatLineNumber(line.leftLine) : ""}
          </span>
          <span aria-hidden="true" className={gutterCellClassName(line.kind, "right")}>
            {showLineNumbers ? formatLineNumber(line.rightLine) : ""}
          </span>
        </>
      ) : (
        <span
          aria-hidden="true"
          className={`pr-2 text-right text-sm leading-6 opacity-60 ${showLineNumbers ? "" : "sr-only"}`}
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
