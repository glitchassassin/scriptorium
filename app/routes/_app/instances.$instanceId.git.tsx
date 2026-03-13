import { useSearchParams } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import { CodeViewer } from "~/components/files/code-viewer";
import { SingleColumnFileList } from "~/components/files/file-list";
import { ScrollableLayout } from "~/components/shell/scrollable-layout";
import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { getGitChangedFiles, getGitFileDiff, getGitStatusSummary } from "~/lib/instances/git.server";
import { getInstanceOrThrow } from "~/lib/instances/runtime.server";
import type { FileBrowserEntry } from "~/lib/instances/types";
import type { RouteHandle } from "~/lib/route-handle";

import type { Route } from "./+types/instances.$instanceId.git";

export const handle = {
  title: ({ data }: { data?: unknown }) => {
    const instance = (data as { instance?: { name?: string } } | undefined)?.instance;
    return instance?.name ? `${instance.name} / git` : "Git";
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
  const git = getGitStatusSummary(instance.directory);
  const changed = getGitChangedFiles(instance.directory);
  const url = new URL(request.url);
  const path = url.searchParams.get("path");

  let selected = null;
  let selectedError: string | null = null;

  if (path && changed.isRepository) {
    try {
      const result = getGitFileDiff(instance.directory, path);
      selected = result.isRepository ? result : null;
    } catch (error) {
      selectedError = error instanceof Response ? await error.text() : "Failed to load file diff.";
    }
  }

  return {
    changed,
    git,
    instance,
    selected,
    selectedError,
    selectedPath: path,
  };
}

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

function statusLabel(path: string, files: Exclude<Route.ComponentProps["loaderData"]["changed"], { isRepository: false }> ["files"]) {
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
}: {
  label: string;
  onBack: () => void;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-2">
      <button
        aria-label="Back to changed files"
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

function GitListHeader({
  git,
}: {
  git: Route.ComponentProps["loaderData"]["git"];
}) {
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

export default function InstanceGitRoute({ loaderData }: Route.ComponentProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { changed, git, instance, selected, selectedError, selectedPath } = loaderData;
  const entries = changed.isRepository ? toEntries(changed.files.map((file) => file.path)) : [];

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
            label={selected?.oldPath ? `${selected.oldPath} -> ${selectedPath}` : selectedPath}
            onBack={clearSelection}
          />
        }
      >
        {selectedError ? (
          <p className="text-base leading-6">{selectedError}</p>
        ) : selected?.binary ? (
          <p className="text-base leading-6">This file cannot be previewed as text.</p>
        ) : selected ? (
          <CodeViewer
            content={selected.content}
            diffContent={selected.mode === "diff" ? selected.diffContent : undefined}
            diffSide={selected.mode === "diff" ? selected.diffSide : undefined}
            fileName={selectedPath}
            mode={selected.mode === "diff" ? "diff" : "text"}
          />
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
          currentPath={instance.directory}
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
