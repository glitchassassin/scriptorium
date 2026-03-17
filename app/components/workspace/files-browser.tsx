import { useSearchParams } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import { CodeViewer } from "~/components/files/code-viewer";
import { SingleColumnFileList } from "~/components/files/file-list";
import { ScrollableLayout } from "~/components/shell/scrollable-layout";
import type { FileBrowserContent, FileBrowserListing } from "~/lib/instances/types";

type FilesBrowserProps = {
  listing: FileBrowserListing;
  rootPath: string;
  selected: FileBrowserContent | null;
  selectedError: string | null;
  selectedPath: string | null;
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

export function FilesBrowser({ listing, rootPath, selected, selectedError, selectedPath }: FilesBrowserProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  function browseTo(path: string) {
    const next = new URLSearchParams(searchParams);
    next.set("path", path);
    next.delete("file");
    setSearchParams(next);
  }

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
          <CodeViewer content={selected.content} fileName={selected.name} />
        ) : (
          <p className="text-base leading-6">No file content is available for this selection.</p>
        )}
      </ScrollableLayout>
    );
  }

  return (
    <ScrollableLayout header={<FilesListHeader path={formatWorkspacePath(rootPath, listing.currentPath)} />}>
      <section className="space-y-8 pr-1">
        <SingleColumnFileList
          currentPath={listing.currentPath}
          entries={listing.entries}
          emptyLabel="This folder is empty."
          onBrowseTo={browseTo}
          onSelectionChange={(selection) => selectFile(selection?.path ?? null)}
          parentPath={listing.parentPath}
          selectedPath={selectedPath}
          selectionMode="either"
        />
      </section>
    </ScrollableLayout>
  );
}
