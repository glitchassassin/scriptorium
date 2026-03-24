import { useEffect, useState } from "react";
import { data } from "react-router";

import type {
  FileBrowserListing,
  FileBrowserSelection,
  FileBrowserSelectionMode,
  FileTreeNode,
} from "~/lib/instances/types";

import type { Route } from "./+types/files.browse";

import { entriesToFileTreeNodes, findNode, replaceDirectoryChildren } from "~/components/files/file-tree";
import { FileTreeList } from "~/components/files/file-list";

type BrowseLoaderData = {
  error: string | null;
  listing: FileBrowserListing | null;
};

const EMPTY_EXPANDED_PATHS: string[] = [];

export async function loader({ request }: Route.LoaderArgs) {
  const { requireAuthenticatedPasskey } = await import("~/lib/auth/guards.server");
  const { browseFiles, resolveBrowserPath } = await import("~/lib/instances/files.server");

  await requireAuthenticatedPasskey(request);

  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  const baseDirectoryParam = url.searchParams.get("baseDirectory");
  const selectionMode = parseSelectionMode(url.searchParams.get("selectionMode"));

  try {
    const baseDirectory = baseDirectoryParam
      ? resolveBrowserPath(baseDirectoryParam).resolvedPath
      : undefined;

    return data<BrowseLoaderData>({
      error: null,
      listing: browseFiles(path, selectionMode, baseDirectory),
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
  baseDirectory?: string;
  initialPath: string;
  initialExpandedPaths?: string[];
  initialListing?: FileBrowserListing | null;
  selectionMode?: FileBrowserSelectionMode;
  label?: string;
  name?: string;
  value?: string | null;
  onBrowsePathChange?: (path: string) => void;
  onSelectionChange?: (selection: FileBrowserSelection | null) => void;
};

export function FileExplorer({
  route = "/files/browse",
  baseDirectory,
  initialPath,
  initialExpandedPaths,
  initialListing = null,
  selectionMode = "either",
  label,
  name,
  value = null,
  onBrowsePathChange,
  onSelectionChange,
}: FileExplorerProps) {
  const expandedPathDefaults = initialExpandedPaths ?? EMPTY_EXPANDED_PATHS;
  const initialSelection = value ?? (selectionMode === "directory" ? initialPath : null);
  const [selected, setSelected] = useState<FileBrowserSelection | null>(
    initialSelection
      ? {
          path: initialSelection,
          type: selectionMode === "file" ? "file" : "directory",
          name: initialSelection.split("/").filter(Boolean).at(-1) || initialSelection,
        }
      : null,
  );
  const [tree, setTree] = useState<FileTreeNode[]>(() => toInitialTree(initialListing, initialPath));
  const [expandedPaths, setExpandedPaths] = useState<string[]>(expandedPathDefaults);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [directoryErrors, setDirectoryErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    setExpandedPaths(expandedPathDefaults);
    setDirectoryErrors({});

    async function loadRoot() {
      if (initialListing && matchesInitialListing(initialListing, initialPath)) {
        setBrowseError(null);
        onBrowsePathChange?.(initialSelection ?? initialPath);
        return;
      }

      const result = await fetchBrowseListing(route, initialPath, selectionMode, baseDirectory);

      if (cancelled) {
        return;
      }

      if (!result.listing) {
        setBrowseError(result.error);
        setTree([]);
        return;
      }

      setBrowseError(null);
      setTree(entriesToFileTreeNodes(result.listing.entries));
      onBrowsePathChange?.(initialSelection ?? result.listing.currentPath);
    }

    void loadRoot();

    return () => {
      cancelled = true;
    };
  }, [
    baseDirectory,
    expandedPathDefaults,
    initialPath,
    initialSelection,
    onBrowsePathChange,
    route,
    selectionMode,
  ]);

  useEffect(() => {
    if (value) {
      setSelected({
        path: value,
        type: selectionMode === "file" ? "file" : "directory",
        name: value.split("/").filter(Boolean).at(-1) || value,
      });
    }
  }, [selectionMode, value]);

  const selectedPath = selected?.path ?? value ?? initialSelection ?? "";

  function selectPath(selection: FileBrowserSelection | null) {
    setSelected(selection);
    onSelectionChange?.(selection);
    onBrowsePathChange?.(selection?.path ?? initialPath);
  }

  async function loadDirectory(path: string) {
    const result = await fetchBrowseListing(route, path, selectionMode, baseDirectory);

    if (!result.listing) {
      setDirectoryErrors((current) => ({
        ...current,
        [path]: result.error ?? "Failed to browse files.",
      }));
      return;
    }

    const listing = result.listing;

    setBrowseError(null);
    setDirectoryErrors((current) => {
      const next = { ...current };
      delete next[path];
      return next;
    });
    setTree((current) => replaceDirectoryChildren(current, path, entriesToFileTreeNodes(listing.entries)));
  }

  async function toggleDirectory(path: string) {
    const expanded = expandedPaths.includes(path);

    if (expanded) {
      setExpandedPaths((current) => current.filter((entry) => entry !== path));
      return;
    }

    setExpandedPaths((current) => (current.includes(path) ? current : [...current, path]));

    const node = findNode(tree, path);

    if (node?.type === "directory" && node.children === null) {
      void loadDirectory(path);
    }
  }

  function retryDirectory(path: string) {
    void loadDirectory(path);
  }

  return (
    <section className="space-y-3">
      {browseError ? <p className="text-base leading-6">{browseError}</p> : null}
      <FileTreeList
        currentPath={initialPath}
        directoryErrors={directoryErrors}
        emptyLabel="This folder is empty."
        expandedPaths={expandedPaths}
        label={label}
        name={name}
        onSelectionChange={selectPath}
        onRetryDirectory={retryDirectory}
        onToggleDirectory={(path) => void toggleDirectory(path)}
        selectedPath={selectedPath}
        selectionMode={selectionMode}
        tree={tree}
      />
    </section>
  );
}

function matchesInitialListing(initialListing: FileBrowserListing | null, initialPath: string) {
  return initialListing?.currentPath === initialPath;
}

function toInitialTree(initialListing: FileBrowserListing | null, initialPath: string) {
  if (!initialListing || !matchesInitialListing(initialListing, initialPath)) {
    return [];
  }

  return entriesToFileTreeNodes(initialListing.entries);
}

async function fetchBrowseListing(
  route: string,
  path: string,
  selectionMode: FileBrowserSelectionMode,
  baseDirectory?: string,
) {
  const response = await fetch(buildBrowseUrl(route, path, selectionMode, baseDirectory));
  return (await response.json()) as BrowseLoaderData;
}

function buildBrowseUrl(route: string, path: string, selectionMode: FileBrowserSelectionMode, baseDirectory?: string) {
  const searchParams = new URLSearchParams({
    path,
    selectionMode,
  });

  if (baseDirectory) {
    searchParams.set("baseDirectory", baseDirectory);
  }

  return `${route}?${searchParams.toString()}`;
}

function parseSelectionMode(value: string | null) {
  if (value === "directory" || value === "file" || value === "either") {
    return value;
  }

  return "either";
}
