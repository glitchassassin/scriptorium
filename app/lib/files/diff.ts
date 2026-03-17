export type DiffLineKind = "header" | "hunk" | "addition" | "deletion" | "context" | "meta";

export type ParsedDiffLine = {
  kind: DiffLineKind;
  content: string;
  oldLine: number | null;
  newLine: number | null;
  marker: string;
};

export type ParsedDiffHunk = {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: ParsedDiffLine[];
};

function normalizeDiffFilePath(value: string) {
  return value.replace(/^[ab]\//, "");
}

function isDiffMetaLine(line: string) {
  return (
    line.startsWith("diff --git") ||
    line.startsWith("index ") ||
    line.startsWith("--- ") ||
    line.startsWith("+++ ") ||
    line.startsWith("old file mode") ||
    line.startsWith("new file mode") ||
    line.startsWith("deleted file mode") ||
    line.startsWith("copy from") ||
    line.startsWith("copy to") ||
    line.startsWith("rename from") ||
    line.startsWith("rename to")
  );
}

function parseHunkHeader(line: string) {
  const match = /^@@ -(?<oldStart>\d+)(?:,(?<oldCount>\d+))? \+(?<newStart>\d+)(?:,(?<newCount>\d+))? @@/.exec(line);

  if (!match?.groups) {
    return null;
  }

  return {
    oldLine: Number(match.groups.oldStart),
    newLine: Number(match.groups.newStart),
    oldCount: Number(match.groups.oldCount ?? 1),
    newCount: Number(match.groups.newCount ?? 1),
  };
}

export function parseUnifiedDiffHunks(content: string): ParsedDiffHunk[] {
  const normalized = content.replace(/\r\n/g, "\n");
  const sourceLines = normalized.length ? normalized.split("\n") : [""];
  const hunks: ParsedDiffHunk[] = [];

  let oldLine = 0;
  let newLine = 0;
  let currentHunk: ParsedDiffHunk | null = null;

  for (const sourceLine of sourceLines) {
    if (sourceLine.startsWith("@@")) {
      const hunkLocation = parseHunkHeader(sourceLine);

      if (!hunkLocation) {
        continue;
      }

      currentHunk = {
        oldStart: hunkLocation.oldLine,
        oldCount: hunkLocation.oldCount,
        newStart: hunkLocation.newLine,
        newCount: hunkLocation.newCount,
        lines: [],
      };
      oldLine = hunkLocation.oldLine;
      newLine = hunkLocation.newLine;
      hunks.push(currentHunk);
      continue;
    }

    if (!currentHunk || isDiffMetaLine(sourceLine) || sourceLine === "\\ No newline at end of file") {
      continue;
    }

    const marker = sourceLine.at(0) ?? "";
    const payload = sourceLine.slice(1);

    if (marker === "+") {
      currentHunk.lines.push({
        kind: "addition",
        content: payload,
        marker,
        oldLine: null,
        newLine,
      });
      newLine += 1;
      continue;
    }

    if (marker === "-") {
      currentHunk.lines.push({
        kind: "deletion",
        content: payload,
        marker,
        oldLine,
        newLine: null,
      });
      oldLine += 1;
      continue;
    }

    currentHunk.lines.push({
      kind: "context",
      content: marker === " " ? payload : sourceLine,
      marker: marker === " " ? marker : "",
      oldLine: marker === " " ? oldLine : null,
      newLine: marker === " " ? newLine : null,
    });

    if (marker === " ") {
      oldLine += 1;
      newLine += 1;
    }
  }

  return hunks;
}

export function parseUnifiedDiff(content: string): ParsedDiffLine[] {
  const normalized = content.replace(/\r\n/g, "\n");
  const sourceLines = normalized.length ? normalized.split("\n") : [""];
  const parsedLines: ParsedDiffLine[] = [];

  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;

  for (const sourceLine of sourceLines) {
    if (sourceLine.startsWith("@@")) {
      const hunkLocation = parseHunkHeader(sourceLine);
      if (hunkLocation) {
        oldLine = hunkLocation.oldLine;
        newLine = hunkLocation.newLine;
        inHunk = true;
      }

      parsedLines.push({
        kind: "hunk",
        content: sourceLine,
        marker: "@@",
        oldLine: null,
        newLine: null,
      });
      continue;
    }

    if (isDiffMetaLine(sourceLine)) {
      parsedLines.push({
        kind: "meta",
        content: sourceLine,
        marker: "",
        oldLine: null,
        newLine: null,
      });
      continue;
    }

    if (sourceLine === "\\ No newline at end of file") {
      parsedLines.push({
        kind: "meta",
        content: sourceLine,
        marker: "",
        oldLine: null,
        newLine: null,
      });
      continue;
    }

    if (!inHunk) {
      parsedLines.push({
        kind: "meta",
        content: sourceLine,
        marker: "",
        oldLine: null,
        newLine: null,
      });
      continue;
    }

    const marker = sourceLine.at(0) ?? "";
    const payload = sourceLine.slice(1);

    if (marker === "+") {
      parsedLines.push({
        kind: "addition",
        content: payload,
        marker,
        oldLine: null,
        newLine,
      });
      newLine += 1;
      continue;
    }

    if (marker === "-") {
      parsedLines.push({
        kind: "deletion",
        content: payload,
        marker,
        oldLine,
        newLine: null,
      });
      oldLine += 1;
      continue;
    }

    if (marker === " ") {
      parsedLines.push({
        kind: "context",
        content: payload,
        marker,
        oldLine,
        newLine,
      });
      oldLine += 1;
      newLine += 1;
      continue;
    }

    parsedLines.push({
      kind: "context",
      content: sourceLine,
      marker: "",
      oldLine: null,
      newLine: null,
    });
  }

  return parsedLines;
}

export function listUnifiedDiffFiles(content: string) {
  const normalized = content.replace(/\r\n/g, "\n");
  const sourceLines = normalized.length ? normalized.split("\n") : [];
  const files: string[] = [];
  const seen = new Set<string>();

  for (const sourceLine of sourceLines) {
    if (sourceLine.startsWith("+++ ")) {
      const filePath = sourceLine.slice(4).trim();

      if (!filePath || filePath === "/dev/null") {
        continue;
      }

      const normalizedPath = normalizeDiffFilePath(filePath);

      if (!seen.has(normalizedPath)) {
        seen.add(normalizedPath);
        files.push(normalizedPath);
      }

      continue;
    }

    if (!sourceLine.startsWith("diff --git ")) {
      continue;
    }

    const parts = sourceLine.split(" ");
    const fallbackPath = parts[3]?.trim();

    if (!fallbackPath) {
      continue;
    }

    const normalizedPath = normalizeDiffFilePath(fallbackPath);

    if (!seen.has(normalizedPath)) {
      seen.add(normalizedPath);
      files.push(normalizedPath);
    }
  }

  return files;
}
