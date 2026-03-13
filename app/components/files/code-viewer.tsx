import { useMemo } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-css";
import "prismjs/components/prism-diff";
import "prismjs/components/prism-go";
import "prismjs/components/prism-java";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-python";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-yaml";

import { parseUnifiedDiffHunks } from "~/lib/files/diff";
import { detectCodeLanguage } from "~/lib/files/language";

type ViewMode = "text" | "diff";
type DiffSide = "old" | "new";
type LineKind = "text" | "context" | "addition" | "deletion";
type ChunkTone = "addition" | "deletion" | null;

type ViewLine = {
  key: string;
  kind: LineKind;
  content: string;
  leftLine: number | null;
  rightLine: number | null;
  marker: string;
  chunkStartTone: ChunkTone;
  chunkEndTone: ChunkTone;
};

type CodeViewerProps = {
  content: string;
  diffContent?: string;
  diffSide?: DiffSide;
  fileName?: string;
  language?: string | null;
  mode?: ViewMode;
  showLineNumbers?: boolean;
  showDiffMarkers?: boolean;
};

function splitLines(content: string) {
  const normalized = content.replace(/\r\n/g, "\n");
  return normalized.length ? normalized.split("\n") : [""];
}

function buildTextLines(content: string): ViewLine[] {
  return splitLines(content).map((line, index) => ({
    key: `text-${index + 1}`,
    kind: "text",
    content: line,
    leftLine: index + 1,
    rightLine: index + 1,
    marker: "",
    chunkStartTone: null,
    chunkEndTone: null,
  }));
}

function changedTone(kind: LineKind): ChunkTone {
  if (kind === "addition" || kind === "deletion") {
    return kind;
  }

  return null;
}

function annotateChangedGroups(lines: ViewLine[]) {
  let currentGroupStart = -1;
  let currentTone: ChunkTone = null;
  let suppressStartTone = false;

  for (let index = 0; index < lines.length; index += 1) {
    const tone = changedTone(lines[index]?.kind ?? "text");

    if (!tone) {
      if (currentGroupStart >= 0) {
        const startTone = suppressStartTone ? null : currentTone;
        const endTone = currentTone;

        if (startTone) {
          lines[currentGroupStart] = {
            ...lines[currentGroupStart],
            chunkStartTone: startTone,
          };
        }

        if (endTone) {
          lines[index - 1] = {
            ...lines[index - 1],
            chunkEndTone: endTone,
          };
        }

        currentGroupStart = -1;
        currentTone = null;
        suppressStartTone = false;
      }

      continue;
    }

    if (currentGroupStart === -1) {
      currentGroupStart = index;
      currentTone = tone;
      suppressStartTone = false;
      continue;
    }

    if (tone !== currentTone) {
      if (currentTone) {
        if (!suppressStartTone) {
          lines[currentGroupStart] = {
            ...lines[currentGroupStart],
            chunkStartTone: currentTone,
          };
        }

        lines[index - 1] = {
          ...lines[index - 1],
          chunkEndTone: currentTone,
        };
      }

      currentGroupStart = index;
      currentTone = tone;
      suppressStartTone = true;
    }
  }

  if (currentGroupStart >= 0) {
    const startTone = suppressStartTone ? null : currentTone;
    const endTone = currentTone;

    if (startTone) {
      lines[currentGroupStart] = {
        ...lines[currentGroupStart],
        chunkStartTone: startTone,
      };
    }

    if (endTone) {
      lines[lines.length - 1] = {
        ...lines[lines.length - 1],
        chunkEndTone: endTone,
      };
    }
  }

  return lines;
}

function buildDiffLines(content: string, diffContent: string, diffSide: DiffSide): ViewLine[] {
  const sourceLines = splitLines(content);
  const rows: ViewLine[] = [];
  const hunks = parseUnifiedDiffHunks(diffContent);
  let canonicalCursor = 1;

  function pushPlainLine(lineNumber: number) {
    rows.push({
      key: `plain-${lineNumber}`,
      kind: "text",
      content: sourceLines[lineNumber - 1] ?? "",
      leftLine: lineNumber,
      rightLine: lineNumber,
      marker: "",
      chunkStartTone: null,
      chunkEndTone: null,
    });
  }

  for (const hunk of hunks) {
    const chunkRows: ViewLine[] = [];
    const anchorLine = Math.max(diffSide === "new" ? hunk.newStart : hunk.oldStart, 1);

    while (canonicalCursor < anchorLine) {
      pushPlainLine(canonicalCursor);
      canonicalCursor += 1;
    }

    let chunkCursor = anchorLine;

    for (const line of hunk.lines) {
      if (diffSide === "new" && line.kind === "deletion") {
        chunkRows.push({
          key: `chunk-delete-${line.oldLine ?? 0}-${line.content}`,
          kind: "deletion",
          content: line.content,
          leftLine: line.oldLine,
          rightLine: null,
          marker: "-",
          chunkStartTone: null,
          chunkEndTone: null,
        });
        continue;
      }

      if (diffSide === "old" && line.kind === "addition") {
        chunkRows.push({
          key: `chunk-add-${line.newLine ?? 0}-${line.content}`,
          kind: "addition",
          content: line.content,
          leftLine: null,
          rightLine: line.newLine,
          marker: "+",
          chunkStartTone: null,
          chunkEndTone: null,
        });
        continue;
      }

      const currentLine = sourceLines[chunkCursor - 1] ?? line.content;
      const kind: LineKind = line.kind === "addition" || line.kind === "deletion" ? line.kind : "context";

      chunkRows.push({
        key: `chunk-${diffSide}-${chunkCursor}-${kind}`,
        kind,
        content: currentLine,
        leftLine: diffSide === "new" ? line.oldLine : chunkCursor,
        rightLine: diffSide === "new" ? chunkCursor : line.newLine,
        marker: line.kind === "addition" ? "+" : line.kind === "deletion" ? "-" : "",
        chunkStartTone: null,
        chunkEndTone: null,
      });
      chunkCursor += 1;
    }

    rows.push(...annotateChangedGroups(chunkRows));
    canonicalCursor = chunkCursor;
  }

  while (canonicalCursor <= sourceLines.length) {
    pushPlainLine(canonicalCursor);
    canonicalCursor += 1;
  }

  if (rows.length === 0) {
    return buildTextLines(content);
  }

  return rows;
}

function getPrismMarkup(line: string, language: string | null) {
  if (!language || !(language in Prism.languages)) {
    return null;
  }

  return Prism.highlight(line, Prism.languages[language], language);
}

function CodeCell({ content, language }: { content: string; language: string | null }) {
  const markup = getPrismMarkup(content, language);

  return markup ? (
    <code dangerouslySetInnerHTML={{ __html: markup }} />
  ) : (
    <code>{content === "" ? "\u00a0" : content}</code>
  );
}

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
  if (kind === "addition") {
    return "text-white";
  }

  if (kind === "deletion") {
    return "text-white";
  }

  return "text-black/60";
}

function codeCellClassName(kind: LineKind) {
  return `whitespace-pre px-2 ${kind === "deletion" ? "opacity-80" : ""}`;
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
}: CodeViewerProps) {
  const detectedLanguage = useMemo(() => language ?? detectCodeLanguage(fileName ?? ""), [fileName, language]);
  const lines = useMemo(() => {
    if (mode === "diff" && diffContent) {
      return buildDiffLines(content, diffContent, diffSide);
    }

    return buildTextLines(content);
  }, [content, diffContent, diffSide, mode]);

  const showMarkers = mode === "diff" && showDiffMarkers;
  const showDualGutters = mode === "diff";
  const gridTemplateColumns = showDualGutters
    ? showMarkers
      ? "1.5rem 3.5rem 3.5rem minmax(0, 1fr)"
      : "3.5rem 3.5rem minmax(0, 1fr)"
    : "3.5rem minmax(0, 1fr)";

  return (
    <section className="code-viewer overflow-x-auto bg-white text-sm leading-6">
      <div className="inline-block min-w-full w-max font-mono align-top">
        {lines.map((line) => (
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
                <span
                  aria-hidden="true"
                  className={gutterCellClassName(line.kind, "right")}
                >
                  {showLineNumbers ? formatLineNumber(line.leftLine) : ""}
                </span>
                <span
                  aria-hidden="true"
                  className={gutterCellClassName(line.kind, "right")}
                >
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
              <CodeCell content={line.content} language={detectedLanguage} />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
