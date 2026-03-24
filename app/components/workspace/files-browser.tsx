import { useSearchParams } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import { CodeViewerFrame } from "~/components/files/code-viewer/frame";
import { LineBuilder } from "~/components/files/code-viewer/line-builder";
import { LineSelectionLayer } from "~/components/files/code-viewer/line-selection-layer";
import { CodeViewerRows } from "~/components/files/code-viewer/rows";
import { ScrollIndicator } from "~/components/files/code-viewer/scroll-indicator";
import { ScrollableLayout } from "~/components/shell/scrollable-layout";
import type { FileBrowserContent, FileBrowserListing } from "~/lib/instances/types";
import { FileExplorer } from "~/routes/_rpc/files.browse";

type FilesBrowserProps = {
  onInsertReference?: (reference: string) => void;
  listing: FileBrowserListing;
  rootPath: string;
  selected: FileBrowserContent | null;
  selectedError: string | null;
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
  selectedPath,
}: FilesBrowserProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  function selectFile(path: string | null) {
    const next = new URLSearchParams(searchParams);
    next.set("path", listing.currentPath);

    if (path) {
      next.set("file", path);
    } else {
      next.delete("file");
    }

    setSearchParams(next);
  }

  function clearSelection() {
    selectFile(null);
  }

  if (selectedPath) {
    return (
      <ScrollableLayout
        header={
          <FileSelectionHeader
            label={selected ? formatWorkspacePath(rootPath, selected.path) : selectedPath}
            onBack={clearSelection}
          />
        }
      >
        {selectedError ? (
          <p className="text-base leading-6">{selectedError}</p>
        ) : selected?.binary ? (
          <p className="text-base leading-6">This file cannot be previewed as text.</p>
        ) : selected ? (
          <CodeViewerFrame>
            <LineBuilder content={selected.content} fileName={selected.name}>
              {({ changeMarkers, highlightedLines, lines }) => (
                <ScrollIndicator changeMarkers={changeMarkers} mode="text">
                  {({ indicator, scrollPaneRef }) => (
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
                            selectedRowRange={selectedRowRange ?? null}
                            showDualGutters={false}
                            showLineNumbers={true}
                            showDiffMarkers={true}
                          />
                        )}
                      </LineSelectionLayer>
                      {indicator}
                    </>
                  )}
                </ScrollIndicator>
              )}
            </LineBuilder>
          </CodeViewerFrame>
        ) : (
          <p className="text-base leading-6">No file content is available for this selection.</p>
        )}
      </ScrollableLayout>
    );
  }

  return (
    <ScrollableLayout header={<FilesListHeader path={formatWorkspacePath(rootPath, listing.currentPath)} />}>
      <section className="space-y-8 pr-1">
        <FileExplorer
          baseDirectory={rootPath}
          initialListing={listing}
          initialPath={listing.currentPath}
          onSelectionChange={(selection) => selectFile(selection?.path ?? null)}
          selectionMode="either"
        />
      </section>
    </ScrollableLayout>
  );
}
