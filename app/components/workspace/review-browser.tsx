import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";
import { Link, useNavigate, useSearchParams } from "react-router";

import { CodeViewerFrame } from "~/components/files/code-viewer/frame";
import { LineBuilder } from "~/components/files/code-viewer/line-builder";
import { LineSelectionLayer } from "~/components/files/code-viewer/line-selection-layer";
import { CodeViewerRows } from "~/components/files/code-viewer/rows";
import { ScrollIndicator } from "~/components/files/code-viewer/scroll-indicator";
import { buildStatusFilesTree, collectDirectoryPaths, collectFilePaths } from "~/components/files/file-tree";
import { FileTreeList } from "~/components/files/file-list";
import { ScrollableLayout } from "~/components/shell/scrollable-layout";
import { PopupPicker } from "~/components/ui/popup-picker";
import { formatLineReference } from "~/components/workspace/files-browser";
import type { ReviewData, ReviewFileSelection, ReviewMode, ReviewModeOption } from "~/lib/review";
import { getReviewModeLabel } from "~/lib/review";

type ReviewBrowserProps = {
  mode: ReviewMode;
  modes?: ReviewModeOption[];
  onInsertReference?: (reference: string) => void;
  review: ReviewData;
  selected: ReviewFileSelection | null;
  selectedError: string | null;
  selectedPath: string | null;
  switchBasePath?: string;
};

function ReviewModeControl({
  mode,
  modes,
  switchBasePath,
}: {
  mode: ReviewMode;
  modes: ReviewModeOption[];
  switchBasePath?: string;
}) {
  const navigate = useNavigate();

  if (!switchBasePath || modes.length < 2) {
    return <p className="text-base font-bold">{getReviewModeLabel(mode)}</p>;
  }

  return (
    <PopupPicker
      ariaLabel="Review mode"
      emptyLabel="Choose review mode"
      onSelect={(nextMode) => navigate(`${switchBasePath}/${nextMode}`)}
      options={modes.map((option) => ({ label: option.label, value: option.mode }))}
      placement="bottom-start"
      selectedValue={mode}
    />
  );
}

function ReviewSelectionHeader({
  label,
  mode,
  modes,
  nextUrl,
  onBack,
  previousUrl,
  switchBasePath,
}: {
  label: string;
  mode: ReviewMode;
  modes: ReviewModeOption[];
  nextUrl: string | null;
  onBack: () => void;
  previousUrl: string | null;
  switchBasePath?: string;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
      <button
        aria-label={`Back to ${getReviewModeLabel(mode).toLowerCase()}`}
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
            aria-label="Previous file"
            className="inline-flex min-h-11 min-w-11 items-center justify-center"
            to={previousUrl}
          >
            <Icon className="size-5" icon="mdi:arrow-up-bold" />
          </Link>
        ) : (
          <span
            aria-disabled="true"
            aria-label="Previous file"
            className="inline-flex min-h-11 min-w-11 items-center justify-center opacity-25"
          >
            <Icon className="size-5" icon="mdi:arrow-up-bold" />
          </span>
        )}
        {nextUrl ? (
          <Link
            aria-label="Next file"
            className="inline-flex min-h-11 min-w-11 items-center justify-center"
            to={nextUrl}
          >
            <Icon className="size-5" icon="mdi:arrow-down-bold" />
          </Link>
        ) : (
          <span
            aria-disabled="true"
            aria-label="Next file"
            className="inline-flex min-h-11 min-w-11 items-center justify-center opacity-25"
          >
            <Icon className="size-5" icon="mdi:arrow-down-bold" />
          </span>
        )}
      </div>
      <div className="col-span-3 flex justify-start">
        <ReviewModeControl mode={mode} modes={modes} switchBasePath={switchBasePath} />
      </div>
    </div>
  );
}

function ReviewGitMeta({ review }: { review: ReviewData }) {
  if (!review.git) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-sm leading-6 opacity-60">
      {review.git.isRepository ? (
        <>
          <span className="inline-flex items-center gap-0">
            <Icon className="size-4" icon="mdi:source-branch" />
            {review.git.branch ?? "HEAD"}
          </span>
          <span className="inline-flex items-center gap-0">
            <Icon className="size-4" icon="mdi:arrow-up" />
            {review.git.ahead}
            <Icon className="size-4" icon="mdi:arrow-down" />
            {review.git.behind}
          </span>
          <span className="inline-flex items-center gap-0">
            <Icon className="size-4" icon="mdi:file-upload-outline" />
            {review.git.staged}
          </span>
          <span className="inline-flex items-center gap-0">
            <Icon className="size-4" icon="mdi:file-document-edit-outline" />
            {review.git.modified}
          </span>
          <span className="inline-flex items-center gap-0">
            <Icon className="size-4" icon="mdi:file-question-outline" />
            {review.git.untracked}
          </span>
        </>
      ) : (
        <span>Not a git repository</span>
      )}
    </div>
  );
}

function ReviewListHeader({
  mode,
  modes,
  review,
  switchBasePath,
}: {
  mode: ReviewMode;
  modes: ReviewModeOption[];
  review: ReviewData;
  switchBasePath?: string;
}) {
  return (
    <div className="grid min-h-11 w-full grid-cols-[1fr_auto] items-center gap-3">
      <ReviewModeControl mode={mode} modes={modes} switchBasePath={switchBasePath} />
      <ReviewGitMeta review={review} />
    </div>
  );
}

export function ReviewBrowser({
  mode,
  modes = [],
  onInsertReference,
  review,
  selected,
  selectedError,
  selectedPath,
  switchBasePath,
}: ReviewBrowserProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tree = useMemo(() => buildStatusFilesTree(review.files), [review.files]);
  const changedPaths = useMemo(() => collectFilePaths(tree), [tree]);
  const directoryPaths = useMemo(() => collectDirectoryPaths(tree), [tree]);
  const previousDirectoryPathsRef = useRef<string[]>(directoryPaths);
  const [expandedPaths, setExpandedPaths] = useState<string[]>(directoryPaths);
  const selectedIndex = selectedPath ? changedPaths.indexOf(selectedPath) : -1;
  const previousPath = selectedIndex > 0 ? changedPaths[selectedIndex - 1] : null;
  const nextPath = selectedIndex >= 0 && selectedIndex < changedPaths.length - 1 ? changedPaths[selectedIndex + 1] : null;

  useEffect(() => {
    const previousDirectoryPaths = previousDirectoryPathsRef.current;

    setExpandedPaths((current) => {
      const currentExpanded = new Set(current);
      const previousDirectories = new Set(previousDirectoryPaths);

      return directoryPaths.filter((path) => currentExpanded.has(path) || !previousDirectories.has(path));
    });

    previousDirectoryPathsRef.current = directoryPaths;
  }, [directoryPaths]);

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

  function toggleDirectory(path: string) {
    setExpandedPaths((current) =>
      current.includes(path) ? current.filter((entry) => entry !== path) : [...current, path],
    );
  }

  if (selectedPath) {
    return (
      <ScrollableLayout
        header={
          <ReviewSelectionHeader
            label={selected?.oldPath ? `${selected.oldPath} -> ${selectedPath}` : selectedPath}
            mode={mode}
            modes={modes}
            nextUrl={nextPath ? buildSelectionUrl(nextPath) : null}
            onBack={clearSelection}
            previousUrl={previousPath ? buildSelectionUrl(previousPath) : null}
            switchBasePath={switchBasePath}
          />
        }
      >
        {selectedError ? (
          <p className="text-base leading-6">{selectedError}</p>
        ) : selected?.binary ? (
          <p className="text-base leading-6">This file cannot be previewed as text.</p>
        ) : selected ? (
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
    <ScrollableLayout header={<ReviewListHeader mode={mode} modes={modes} review={review} switchBasePath={switchBasePath} />}>
      <section className="space-y-8 pr-1">
        <FileTreeList
          currentPath=""
          emptyLabel={review.emptyLabel}
          expandedPaths={expandedPaths}
          onSelectionChange={(selection) => handleSelection(selection?.path ?? null)}
          onToggleDirectory={toggleDirectory}
          renderPrefix={(node) => node.status ?? null}
          selectedPath={selectedPath}
          selectionMode="file"
          tree={tree}
        />
      </section>
    </ScrollableLayout>
  );
}
