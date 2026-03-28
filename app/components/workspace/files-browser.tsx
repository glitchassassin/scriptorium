import type { ReactNode, RefObject } from "react";
import { useSearchParams } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import { CodeViewerFrame } from "~/components/files/code-viewer/frame";
import { LineBuilder } from "~/components/files/code-viewer/line-builder";
import { LineSelectionLayer } from "~/components/files/code-viewer/line-selection-layer";
import { CodeViewerRows } from "~/components/files/code-viewer/rows";
import { ScrollIndicator } from "~/components/files/code-viewer/scroll-indicator";
import type { ViewLine } from "~/components/files/code-viewer/types";
import { ScrollableLayout } from "~/components/shell/scrollable-layout";
import type { FileBrowserContent, FileBrowserLineRange, FileBrowserListing } from "~/lib/instances/types";
import { FileExplorer } from "~/routes/_rpc/files.browse";

type FilesBrowserProps = {
  onInsertReference?: (reference: string) => void;
  listing: FileBrowserListing;
  rootPath: string;
  selected: FileBrowserContent | null;
  selectedError: string | null;
  selectedLineRange?: FileBrowserLineRange | null;
  selectedPath: string | null;
};

type LineRange = {
  gutter?: "single" | "left" | "right";
  start: number;
  end: number;
};

export function formatWorkspacePath(rootPath: string, filePath: string) {
  if (filePath === rootPath) {
    return ".";
  }

  if (filePath.startsWith(`${rootPath}/`)) {
    return filePath.slice(rootPath.length + 1);
  }

  return filePath;
}

export function formatLineReference(path: string, range: LineRange) {
  const start = Math.min(range.start, range.end);
  const end = Math.max(range.start, range.end);

  return start === end ? `@${path}:${start}` : `@${path}:${start}-${end}`;
}

function FileSelectionHeader({
  label,
  onBack,
}: {
  label: string;
  onBack: () => void;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-2">
      <button
        aria-label="Back to workspace files"
        className="inline-flex min-h-11 min-w-11 items-center justify-center"
        onClick={onBack}
        type="button"
      >
        <Icon className="size-5" icon="mdi:arrow-left" />
      </button>
      <p className="text-base font-bold break-all">{label}</p>
    </div>
  );
}

function FilesListHeader({ path }: { path: string }) {
  return (
    <div className="grid min-h-11 w-full grid-cols-[1fr] items-center gap-3">
      <p className="truncate text-base font-bold">{path}</p>
    </div>
  );
}

export function FilesBrowser({
  listing,
  onInsertReference,
  rootPath,
  selected,
  selectedError,
  selectedLineRange,
  selectedPath,
}: FilesBrowserProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  function selectFile(path: string | null) {
    const next = new URLSearchParams(searchParams);
    next.delete("line");
    next.delete("endLine");
    next.set("path", formatWorkspacePath(rootPath, listing.currentPath));

    if (path) {
      next.set("file", formatWorkspacePath(rootPath, path));
    } else {
      next.delete("file");
    }

    setSearchParams(next);
  }

  function clearSelection() {
    selectFile(null);
  }

  return (
    <ScrollableLayout
      header={
        selectedPath ? (
          <FileSelectionHeader
            label={selected ? formatWorkspacePath(rootPath, selected.path) : selectedPath}
            onBack={clearSelection}
          />
        ) : (
          <FilesListHeader path={formatWorkspacePath(rootPath, listing.currentPath)} />
        )
      }
    >
      <section className={selectedPath ? "hidden" : "space-y-8 pr-1"}>
        <FileExplorer
          baseDirectory={rootPath}
          initialListing={listing}
          initialPath={listing.currentPath}
          onSelectionChange={(selection) => selectFile(selection?.path ?? null)}
          selectionMode="either"
        />
      </section>
      {selectedPath ? (
        selectedError ? (
          <p className="text-base leading-6">{selectedError}</p>
        ) : selected?.binary ? (
          <p className="text-base leading-6">This file cannot be previewed as text.</p>
        ) : selected ? (
          <CodeViewerFrame>
            <LineBuilder content={selected.content} fileName={selected.name}>
              {({ changeMarkers, highlightedLines, lines }) => (
                <ScrollIndicator changeMarkers={changeMarkers} mode="text">
                  {({ indicator, scrollPaneRef }) => (
                    <SelectedFileCodeViewer
                      indicator={indicator}
                      lines={lines}
                      onInsertReference={onInsertReference}
                      rootPath={rootPath}
                      scrollPaneRef={scrollPaneRef}
                      selected={selected}
                      selectedLineRange={selectedLineRange ?? null}
                      selectedPath={selectedPath}
                      highlightedLines={highlightedLines}
                    />
                  )}
                </ScrollIndicator>
              )}
            </LineBuilder>
          </CodeViewerFrame>
        ) : (
          <p className="text-base leading-6">No file content is available for this selection.</p>
        )
      ) : null}
    </ScrollableLayout>
  );
}

function SelectedFileCodeViewer({
  highlightedLines,
  indicator,
  lines,
  onInsertReference,
  rootPath,
  scrollPaneRef,
  selected,
  selectedLineRange,
  selectedPath,
}: {
  highlightedLines: Array<string | null> | null;
  indicator: ReactNode;
  lines: ViewLine[];
  onInsertReference?: (reference: string) => void;
  rootPath: string;
  scrollPaneRef: RefObject<HTMLDivElement | null>;
  selected: FileBrowserContent;
  selectedLineRange: FileBrowserLineRange | null;
  selectedPath: string;
}) {
  const linkedRowRange = resolveLinkedRowRange(selectedLineRange, lines.length);
  const scrollToRowKey = linkedRowRange && selectedPath
    ? `${selectedPath}:${linkedRowRange.start}-${linkedRowRange.end}`
    : null;

  return (
    <>
      <LineSelectionLayer
        key={selectedPath}
        onInsert={(range) => {
          if (!onInsertReference) {
            return;
          }

          onInsertReference(formatLineReference(formatWorkspacePath(rootPath, selected.path), range));
        }}
      >
        {({ onSelectLine, selectedRowRange }) => (
          <CodeViewerRows
            highlightedLines={highlightedLines}
            lines={lines}
            mode="text"
            onSelectLine={onSelectLine}
            scrollPaneRef={scrollPaneRef}
            scrollToRowIndex={selectedRowRange ? null : linkedRowRange?.start ?? null}
            scrollToRowKey={selectedRowRange ? null : scrollToRowKey}
            selectedRowRange={selectedRowRange ?? linkedRowRange}
            showDualGutters={false}
            showLineNumbers={true}
            showDiffMarkers={true}
          />
        )}
      </LineSelectionLayer>
      {indicator}
    </>
  );
}

function resolveLinkedRowRange(selectedLineRange: FileBrowserLineRange | null | undefined, lineCount: number) {
  if (!selectedLineRange || lineCount < 1) {
    return null;
  }

  const start = Math.min(selectedLineRange.start, selectedLineRange.end) - 1;
  const end = Math.max(selectedLineRange.start, selectedLineRange.end) - 1;

  if (start < 0 || start >= lineCount) {
    return null;
  }

  return {
    start,
    end: Math.min(end, lineCount - 1),
  };
}
