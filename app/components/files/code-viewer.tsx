import { CodeViewerFrame } from "~/components/files/code-viewer/frame";
import { LineBuilder } from "~/components/files/code-viewer/line-builder";
import { LineSelectionLayer } from "~/components/files/code-viewer/line-selection-layer";
import { CodeViewerRows } from "~/components/files/code-viewer/rows";
import { ScrollIndicator } from "~/components/files/code-viewer/scroll-indicator";
import type { CodeViewerProps } from "~/components/files/code-viewer/types";

export function CodeViewer({
  content,
  diffContent,
  diffSide = "new",
  fileName,
  language,
  mode = "text",
  onSelectLine,
  selectedRowRange,
  showLineNumbers = true,
  showDiffMarkers = true,
  showScrollIndicator = true,
}: CodeViewerProps) {
  return (
    <CodeViewerFrame>
      <LineBuilder content={content} diffContent={diffContent} diffSide={diffSide} fileName={fileName} language={language} mode={mode}>
        {({ changeMarkers, highlightedLines, lines }) => (
          <ScrollIndicator changeMarkers={changeMarkers} mode={mode}>
            {({ indicator, scrollPaneRef }) => (
              <>
                <CodeViewerRows
                  highlightedLines={highlightedLines}
                  lines={lines}
                  mode={mode}
                  onSelectLine={onSelectLine}
                  scrollPaneRef={scrollPaneRef}
                  selectedRowRange={selectedRowRange ?? null}
                  showDualGutters={mode === "diff"}
                  showLineNumbers={showLineNumbers}
                  showDiffMarkers={showDiffMarkers}
                />
                {showScrollIndicator ? indicator : null}
              </>
            )}
          </ScrollIndicator>
        )}
      </LineBuilder>
    </CodeViewerFrame>
  );
}
