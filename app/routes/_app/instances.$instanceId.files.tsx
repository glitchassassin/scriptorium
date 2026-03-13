import { useSearchParams } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import { CodeViewer } from "~/components/files/code-viewer";
import { SingleColumnFileList } from "~/components/files/file-list";
import { ScrollableLayout } from "~/components/shell/scrollable-layout";
import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { browseInstanceFiles, readInstanceFile } from "~/lib/instances/files.server";
import { getInstanceOrThrow } from "~/lib/instances/runtime.server";
import type { RouteHandle } from "~/lib/route-handle";

import type { Route } from "./+types/instances.$instanceId.files";

export const handle = {
  title: ({ data }: { data?: unknown }) => {
    const instance = (data as { instance?: { name?: string } } | undefined)?.instance;
    return instance?.name ? `${instance.name} / files` : "Files";
  },
  iconNavActions: ({ params }: { params: Record<string, string | undefined> }) => {
    const instanceId = params["instanceId"] ?? "";

    return [
      {
        icon: "mdi:view-dashboard-outline",
        label: "Instance overview",
        to: `/instances/${instanceId}`,
        end: true,
      },
      {
        icon: "mdi:source-branch",
        label: "Git view",
        to: `/instances/${instanceId}/git`,
        end: true,
      },
      {
        icon: "mdi:file-document-multiple-outline",
        label: "Files view",
        to: `/instances/${instanceId}/files`,
        end: true,
      },
    ];
  },
} satisfies RouteHandle;

export async function loader({ params, request }: Route.LoaderArgs) {
  await requireAuthenticatedPasskey(request);

  const instanceId = (params as Record<string, string | undefined>).instanceId ?? "";
  const instance = await getInstanceOrThrow(instanceId);
  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  const file = url.searchParams.get("file");
  const listing = browseInstanceFiles(path, instance.directory, "either");

  let selected = null;
  let selectedError: string | null = null;

  if (file) {
    try {
      selected = readInstanceFile(file, instance.directory);
    } catch (error) {
      selectedError = error instanceof Response ? await error.text() : "Failed to read file.";
    }
  }

  return {
    instance,
    listing,
    selected,
    selectedError,
    selectedPath: file,
  };
}

function formatPath(root: string, filePath: string) {
  if (filePath === root) {
    return ".";
  }

  if (filePath.startsWith(`${root}/`)) {
    return filePath.slice(root.length + 1);
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

export default function InstanceFilesRoute({ loaderData }: Route.ComponentProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { instance, listing, selected, selectedError, selectedPath } = loaderData;

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
            label={selected ? formatPath(instance.directory, selected.path) : selectedPath}
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
    <ScrollableLayout
      header={<FilesListHeader path={formatPath(instance.directory, listing.currentPath)} />}
    >
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
