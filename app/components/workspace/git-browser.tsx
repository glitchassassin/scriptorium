import { Icon } from "@iconify/react";
import "@iconify-json/mdi";
import { Link, useSearchParams } from "react-router";

import { CodeViewerFrame } from "~/components/files/code-viewer/frame";
import { LineBuilder } from "~/components/files/code-viewer/line-builder";
import { LineSelectionLayer } from "~/components/files/code-viewer/line-selection-layer";
import { CodeViewerRows } from "~/components/files/code-viewer/rows";
import { ScrollIndicator } from "~/components/files/code-viewer/scroll-indicator";
import { SingleColumnFileList } from "~/components/files/file-list";
import { ScrollableLayout } from "~/components/shell/scrollable-layout";
import { formatLineReference } from "~/components/workspace/files-browser";
import type {
  FileBrowserEntry,
  GitChangedFile,
  GitChangedFiles,
  GitFileDiffResult,
  GitStatusSummary,
} from "~/lib/instances/types";

type GitBrowserProps = {
  changed: GitChangedFiles;
  git: GitStatusSummary;
  onInsertReference?: (reference: string) => void;
  rootPath: string;
  selected: GitFileDiffResult | null;
  selectedError: string | null;
  selectedPath: string | null;
};

function toEntries(paths: string[]): FileBrowserEntry[] {
  return paths.map((path) => ({
    name: path.split("/").at(-1) ?? path,
    path,
    type: "file",
  }));
}

function parentDirectoryLabel(path: string) {
  const segments = path.split("/").filter(Boolean);

  if (segments.length <= 1) {
    return null;
  }

  return `${segments.slice(0, -1).join("/")}/`;
}

function statusLabel(path: string, files: GitChangedFile[]) {
  const match = files.find((file) => file.path === path);

  if (!match) {
    return null;
  }

  if (match.changeType === "added" || match.changeType === "untracked") {
    return "A";
  }

  if (match.changeType === "deleted") {
    return "D";
  }

  return "M";
}

function GitSelectionHeader({
  label,
  onBack,
  nextUrl,
  previousUrl,
}: {
  label: string;
  onBack: () => void;
  nextUrl: string | null;
  previousUrl: string | null;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
      <button
        aria-label="Back to changed files"
        className="inline-flex min-h-11 min-w-11 items-center justify-center"
        onClick={onBack}
        type="button"
      >
        <Icon className="size-5" icon="mdi:arrow-left" />
      </button>
      <p className="text-base font-bold break-all">{label}</p>
      <div className="flex items-center gap-0">
        {previousUrl ? (
          <Link
            aria-label="Previous changed file"
            className="inline-flex min-h-11 min-w-11 items-center justify-center"
            to={previousUrl}
          >
            <Icon className="size-5" icon="mdi:arrow-up-bold" />
          </Link>
        ) : (
          <span
            aria-disabled="true"
            aria-label="Previous changed file"
            className="inline-flex min-h-11 min-w-11 items-center justify-center opacity-25"
          >
            <Icon className="size-5" icon="mdi:arrow-up-bold" />
          </span>
        )}
        {nextUrl ? (
          <Link
            aria-label="Next changed file"
            className="inline-flex min-h-11 min-w-11 items-center justify-center"
            to={nextUrl}
          >
            <Icon className="size-5" icon="mdi:arrow-down-bold" />
          </Link>
        ) : (
          <span
            aria-disabled="true"
            aria-label="Next changed file"
            className="inline-flex min-h-11 min-w-11 items-center justify-center opacity-25"
          >
            <Icon className="size-5" icon="mdi:arrow-down-bold" />
          </span>
        )}
      </div>
    </div>
  );
}

function GitListHeader({ git }: { git: GitStatusSummary }) {
  return (
    <div className="grid min-h-11 w-full grid-cols-[1fr_auto] items-center gap-3">
      <p className="text-base font-bold">Changed Files</p>
      <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-sm leading-6 opacity-60">
        {git.isRepository ? (
          <>
            <span className="inline-flex items-center gap-0">
              <Icon className="size-4" icon="mdi:source-branch" />
              {git.branch ?? "HEAD"}
            </span>
            <span className="inline-flex items-center gap-0">
              <Icon className="size-4" icon="mdi:arrow-up" />
              {git.ahead}
              <Icon className="size-4" icon="mdi:arrow-down" />
              {git.behind}
            </span>
            <span className="inline-flex items-center gap-0">
              <Icon className="size-4" icon="mdi:file-upload-outline" />
              {git.staged}
            </span>
            <span className="inline-flex items-center gap-0">
              <Icon className="size-4" icon="mdi:file-document-edit-outline" />
              {git.modified}
            </span>
            <span className="inline-flex items-center gap-0">
              <Icon className="size-4" icon="mdi:file-question-outline" />
              {git.untracked}
            </span>
          </>
        ) : (
          <span>Not a git repository</span>
        )}
      </div>
    </div>
  );
}

export function GitBrowser({
  changed,
  git,
  onInsertReference,
  rootPath,
  selected,
  selectedError,
  selectedPath,
}: GitBrowserProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const entries = changed.isRepository ? toEntries(changed.files.map((file) => file.path)) : [];
  const changedPaths = changed.isRepository ? changed.files.map((file) => file.path) : [];
  const selectedIndex = selectedPath ? changedPaths.indexOf(selectedPath) : -1;
  const previousPath = selectedIndex > 0 ? changedPaths[selectedIndex - 1] : null;
  const nextPath = selectedIndex >= 0 && selectedIndex < changedPaths.length - 1 ? changedPaths[selectedIndex + 1] : null;

  function buildSelectionUrl(path: string | null) {
    const next = new URLSearchParams(searchParams);

    if (path) {
      next.set("path", path);
    } else {
      next.delete("path");
    }

    const query = next.toString();
    return query ? `?${query}` : "";
  }

  function handleSelection(path: string | null) {
    const next = new URLSearchParams(searchParams);

    if (path) {
      next.set("path", path);
    } else {
      next.delete("path");
    }

    setSearchParams(next);
  }

  function clearSelection() {
    handleSelection(null);
  }

  if (selectedPath) {
    return (
      <ScrollableLayout
        header={
          <GitSelectionHeader
            label={selected?.isRepository && selected.oldPath ? `${selected.oldPath} -> ${selectedPath}` : selectedPath}
            nextUrl={nextPath ? buildSelectionUrl(nextPath) : null}
            onBack={clearSelection}
            previousUrl={previousPath ? buildSelectionUrl(previousPath) : null}
          />
        }
      >
        {selectedError ? (
          <p className="text-base leading-6">{selectedError}</p>
        ) : selected?.isRepository && selected.binary ? (
          <p className="text-base leading-6">This file cannot be previewed as text.</p>
        ) : selected?.isRepository ? (
          <CodeViewerFrame>
            <LineBuilder
              content={selected.content}
              diffContent={selected.mode === "diff" ? selected.diffContent : undefined}
              diffSide={selected.mode === "diff" ? selected.diffSide : undefined}
              fileName={selectedPath}
              mode={selected.mode === "diff" ? "diff" : "text"}
            >
              {({ changeMarkers, highlightedLines, lines }) => (
                <ScrollIndicator changeMarkers={changeMarkers} mode={selected.mode === "diff" ? "diff" : "text"}>
                  {({ indicator, scrollPaneRef }) => (
                    <>
                      <LineSelectionLayer
                        key={selectedPath}
                        onInsert={(range) => {
                          if (!onInsertReference) {
                            return;
                          }

                          onInsertReference(formatLineReference(selectedPath, range));
                        }}
                      >
                        {({ onSelectLine, selectedRowRange }) => (
                          <CodeViewerRows
                            highlightedLines={highlightedLines}
                            lines={lines}
                            mode={selected.mode === "diff" ? "diff" : "text"}
                            onSelectLine={onSelectLine}
                            scrollPaneRef={scrollPaneRef}
                            selectedRowRange={selectedRowRange ?? null}
                            showDualGutters={selected.mode === "diff"}
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
          <p className="text-base leading-6">No diff is available for this selection.</p>
        )}
      </ScrollableLayout>
    );
  }

  return (
    <ScrollableLayout header={<GitListHeader git={git} />}>
      <section className="space-y-8 pr-1">
        <SingleColumnFileList
          currentPath={rootPath}
          entries={entries}
          emptyLabel="No uncommitted changes."
          getItemDescription={(entry) => parentDirectoryLabel(entry.path)}
          getItemPrefix={(entry) =>
            changed.isRepository ? statusLabel(entry.path, changed.files) : null
          }
          onSelectionChange={(selection) => handleSelection(selection?.path ?? null)}
          parentPath={null}
          selectedPath={selectedPath}
          selectionMode="file"
        />
      </section>
    </ScrollableLayout>
  );
}
