import { useEffect, useRef, useState } from "react";
import { data, useFetcher } from "react-router";

import type {
  FileBrowserListing,
  FileBrowserSelection,
  FileBrowserSelectionMode,
} from "~/lib/instances/types";

import type { Route } from "./+types/files.browse";

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
  onSelectionChange?: (selection: FileBrowserSelection | null) => void;
};

export function FileExplorer({
  route = "/files/browse",
  initialPath,
  selectionMode = "either",
  label,
  name,
  value = null,
  onSelectionChange,
}: FileExplorerProps) {
  const browseFetcher = useFetcher<typeof loader>();
  const [selected, setSelected] = useState<FileBrowserSelection | null>(
    value ? { path: value, type: "directory", name: value.split("/").filter(Boolean).at(-1) || value } : null,
  );
  const listContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    browseFetcher.load(buildBrowseUrl(route, initialPath, selectionMode));
  }, [initialPath, route, selectionMode]);

  const listing = browseFetcher.data?.listing;
  const browseError = browseFetcher.data?.error;
  const activePath = listing?.currentPath ?? initialPath;
  const canSelectCurrentDirectory = selectionMode === "directory" || selectionMode === "either";
  const isLoading = browseFetcher.state !== "idle";
  const selectedPath = selected?.path ?? value ?? "";
  const formValue = canSelectCurrentDirectory ? activePath : selectedPath;

  function browseTo(path: string) {
    if (listContainerRef.current) {
      listContainerRef.current.scrollTop = 0;
    }

    browseFetcher.load(buildBrowseUrl(route, path, selectionMode));
  }

  function selectPath(path: string, type: FileBrowserSelection["type"]) {
    const selection = {
      path,
      type,
      name: path.split("/").filter(Boolean).at(-1) || path,
    } satisfies FileBrowserSelection;

    setSelected(selection);
    onSelectionChange?.(selection);
  }

  return (
    <section className="space-y-3">
      {label ? <p className="text-sm uppercase tracking-[0.08em]">{label}</p> : null}
      {name ? <input name={name} type="hidden" value={formValue} /> : null}
      <p className="min-w-0 truncate text-sm leading-6">{activePath}</p>
      {browseError ? <p className="text-base leading-6">{browseError}</p> : null}
      <div className="max-h-96 overflow-y-auto border-l-2 border-black" ref={listContainerRef}>
      <ul className="space-y-1">
        {listing?.parentPath ? (
          <li>
            <button
              className="block min-h-9 w-full px-3 py-1 text-left text-base disabled:opacity-25"
              disabled={isLoading}
              onClick={() => browseTo(listing.parentPath!)}
              type="button"
            >
              <p className="truncate">../</p>
            </button>
          </li>
        ) : null}
        {listing?.entries.length ? (
          listing.entries.map((entry) => {
            const canSelectEntry =
              selectionMode === "either" ||
              (selectionMode === "directory" && entry.type === "directory") ||
              (selectionMode === "file" && entry.type === "file");
            const isSelected = selectedPath === entry.path;

            return (
              <li
                className={isSelected ? "border-l-4 border-l-black font-bold" : ""}
                key={entry.path}
              >
                {entry.type === "directory" ? (
                  <button
                    className="block min-h-9 w-full px-3 py-1 text-left text-base disabled:opacity-25"
                    disabled={isLoading}
                    onClick={() => browseTo(entry.path)}
                    type="button"
                  >
                    <p className="truncate">{entry.name}/</p>
                  </button>
                ) : canSelectEntry ? (
                  <button
                    className={`block min-h-9 w-full px-3 py-1 text-left text-base disabled:opacity-25 ${isSelected ? "bg-black text-white" : ""}`}
                    disabled={isLoading}
                    onClick={() => selectPath(entry.path, entry.type)}
                    type="button"
                  >
                    <p className="truncate">{entry.name}</p>
                  </button>
                ) : (
                  <div className="px-3 py-1">
                    <p className="truncate text-base">{entry.name}</p>
                  </div>
                )}
              </li>
            );
          })
        ) : (
          <li className="min-h-11 px-3 py-2 text-base">{isLoading ? "Loading directory..." : "This folder is empty."}</li>
        )}
      </ul>
      </div>
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
