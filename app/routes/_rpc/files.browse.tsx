import { useEffect, useState } from "react";
import { data, useFetcher } from "react-router";

import type {
  FileBrowserListing,
  FileBrowserSelection,
  FileBrowserSelectionMode,
} from "~/lib/instances/types";

import type { Route } from "./+types/files.browse";

import { SingleColumnFileList } from "~/components/files/file-list";

type BrowseLoaderData = {
  error: string | null;
  listing: FileBrowserListing | null;
};

export async function loader({ request }: Route.LoaderArgs) {
  const { requireAuthenticatedPasskey } = await import("~/lib/auth/guards.server");
  const { browseFiles } = await import("~/lib/instances/files.server");

  await requireAuthenticatedPasskey(request);

  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  const selectionMode = parseSelectionMode(url.searchParams.get("selectionMode"));

  try {
    return data<BrowseLoaderData>({
      error: null,
      listing: browseFiles(path, selectionMode),
    });
  } catch (error) {
    return data<BrowseLoaderData>(
      {
        error: error instanceof Response ? await error.text() : "Failed to browse files.",
        listing: null,
      },
      { status: error instanceof Response ? error.status : 400 },
    );
  }
}

type FileExplorerProps = {
  route?: string;
  initialPath: string;
  selectionMode?: FileBrowserSelectionMode;
  label?: string;
  name?: string;
  value?: string | null;
  onBrowsePathChange?: (path: string) => void;
  onSelectionChange?: (selection: FileBrowserSelection | null) => void;
};

export function FileExplorer({
  route = "/files/browse",
  initialPath,
  selectionMode = "either",
  label,
  name,
  value = null,
  onBrowsePathChange,
  onSelectionChange,
}: FileExplorerProps) {
  const browseFetcher = useFetcher<typeof loader>();
  const [selected, setSelected] = useState<FileBrowserSelection | null>(
    value
      ? {
          path: value,
          type: "directory",
          name: value.split("/").filter(Boolean).at(-1) || value,
        }
      : null,
  );

  useEffect(() => {
    browseFetcher.load(buildBrowseUrl(route, initialPath, selectionMode));
  }, [initialPath, route, selectionMode]);

  useEffect(() => {
    if (value) {
      setSelected({
        path: value,
        type: "directory",
        name: value.split("/").filter(Boolean).at(-1) || value,
      });
    }
  }, [value]);

  const listing = browseFetcher.data?.listing;
  const browseError = browseFetcher.data?.error;
  const activePath = listing?.currentPath ?? initialPath;
  const isLoading = browseFetcher.state !== "idle";
  const selectedPath = selected?.path ?? value ?? "";

  function browseTo(path: string) {
    browseFetcher.load(buildBrowseUrl(route, path, selectionMode));
  }

  function selectPath(selection: FileBrowserSelection | null) {
    setSelected(selection);
    onSelectionChange?.(selection);
  }

  useEffect(() => {
    onBrowsePathChange?.(activePath);
  }, [activePath, onBrowsePathChange]);

  return (
    <section className="space-y-3">
      {browseError ? <p className="text-base leading-6">{browseError}</p> : null}
      <SingleColumnFileList
        currentPath={activePath}
        entries={listing?.entries || []}
        emptyLabel="This folder is empty."
        isLoading={isLoading}
        label={label}
        name={name}
        onBrowseTo={browseTo}
        onSelectionChange={selectPath}
        parentPath={listing?.parentPath || null}
        selectedPath={selectedPath}
        selectionMode={selectionMode}
      />
    </section>
  );
}

function buildBrowseUrl(route: string, path: string, selectionMode: FileBrowserSelectionMode) {
  const searchParams = new URLSearchParams({
    path,
    selectionMode,
  });

  return `${route}?${searchParams.toString()}`;
}

function parseSelectionMode(value: string | null) {
  if (value === "directory" || value === "file" || value === "either") {
    return value;
  }

  return "either";
}
