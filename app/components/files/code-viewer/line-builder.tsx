import { useMemo } from "react";
import type { ReactNode } from "react";

import { getPrismLineMarkup } from "~/components/files/code-viewer/highlighting";
import { buildChangeMarkers, buildDiffLines, buildTextLines } from "~/components/files/code-viewer/model";
import type { ChangeMarker, CodeViewerProps, ViewLine } from "~/components/files/code-viewer/types";
import { detectCodeLanguage } from "~/lib/files/language";

type LineBuilderProps = Pick<CodeViewerProps, "content" | "diffContent" | "diffSide" | "fileName" | "language" | "mode"> & {
  children: (props: {
    changeMarkers: ChangeMarker[];
    highlightedLines: Array<string | null> | null;
    lines: ViewLine[];
  }) => ReactNode;
};

function resolveCurrentFileLines(lines: Array<{ currentFileLine: number | null }>) {
  return lines.map((line, index) => {
    if (line.currentFileLine !== null) {
      return line.currentFileLine;
    }

    for (let next = index + 1; next < lines.length; next += 1) {
      const value = lines[next]?.currentFileLine;

      if (value !== null && value !== undefined) {
        return value;
      }
    }

    for (let previous = index - 1; previous >= 0; previous -= 1) {
      const value = lines[previous]?.currentFileLine;

      if (value !== null && value !== undefined) {
        return value;
      }
    }

    return null;
  });
}

export function LineBuilder({
  children,
  content,
  diffContent,
  diffSide = "new",
  fileName,
  language,
  mode = "text",
}: LineBuilderProps) {
  const detectedLanguage = useMemo(() => language ?? detectCodeLanguage(fileName ?? ""), [fileName, language]);
  const lines = useMemo(() => {
    if (mode === "diff" && diffContent) {
      return buildDiffLines(content, diffContent, diffSide);
    }

    return buildTextLines(content);
  }, [content, diffContent, diffSide, mode]);
  const resolvedLines = useMemo(() => {
    const resolvedCurrentFileLines = resolveCurrentFileLines(lines);
    return lines.map((line, index) => ({ ...line, currentFileLine: resolvedCurrentFileLines[index] ?? null }));
  }, [lines]);
  const changeMarkers = useMemo(() => (mode === "diff" ? buildChangeMarkers(resolvedLines) : []), [mode, resolvedLines]);
  const highlightedLines = useMemo(
    () => getPrismLineMarkup(resolvedLines.map((line) => line.content).join("\n"), detectedLanguage),
    [detectedLanguage, resolvedLines],
  );

  return children({ changeMarkers, highlightedLines, lines: resolvedLines });
}
