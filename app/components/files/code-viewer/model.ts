import { parseUnifiedDiffHunks } from "~/lib/files/diff";

import type { ChangeMarker, ChunkTone, DiffSide, LineKind, ViewLine } from "./types";

const MIN_MARKER_HEIGHT_RATIO = 0.015;

function splitLines(content: string) {
  const normalized = content.replace(/\r\n/g, "\n");
  return normalized.length ? normalized.split("\n") : [""];
}

export function buildTextLines(content: string): ViewLine[] {
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

export function buildDiffLines(content: string, diffContent: string, diffSide: DiffSide): ViewLine[] {
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

export function buildChangeMarkers(lines: ViewLine[]): ChangeMarker[] {
  if (lines.length === 0) {
    return [];
  }

  const markers: ChangeMarker[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (line?.kind !== "addition" && line?.kind !== "deletion") {
      continue;
    }

    const startIndex = index;
    const kind = line.kind;

    while (index + 1 < lines.length && lines[index + 1]?.kind === kind) {
      index += 1;
    }

    const blockLength = index - startIndex + 1;
    markers.push({
      kind,
      top: startIndex / lines.length,
      height: Math.max(blockLength / lines.length, MIN_MARKER_HEIGHT_RATIO),
    });
  }

  return markers;
}
