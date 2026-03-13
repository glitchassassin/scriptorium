import { homedir } from "node:os";
import { basename, relative, resolve } from "node:path";
import { readdirSync, statSync } from "node:fs";

import type {
  FileBrowserEntry,
  FileBrowserListing,
  FileBrowserSelection,
  FileBrowserSelectionMode,
} from "~/lib/instances/types";

function getBrowserRoot() {
  return resolve(process.env.SCRIPTORIUM_BROWSER_ROOT?.trim() || homedir());
}

function isWithinRoot(rootPath: string, candidatePath: string) {
  const normalizedRoot = resolve(rootPath);
  const normalizedCandidate = resolve(candidatePath);
  const pathRelative = relative(normalizedRoot, normalizedCandidate);

  return pathRelative === "" || (!pathRelative.startsWith("..") && !pathRelative.startsWith("../"));
}

export function resolveBrowserPath(inputPath: string | null | undefined) {
  const rootPath = getBrowserRoot();
  const resolvedPath = resolve(inputPath?.trim() || rootPath);

  if (!isWithinRoot(rootPath, resolvedPath)) {
    throw new Response("Path is outside the allowed browser root.", { status: 403 });
  }

  return { rootPath, resolvedPath };
}

function assertSelectionType(path: string, selectionMode: FileBrowserSelectionMode) {
  const stat = statSync(path);
  const type = stat.isDirectory() ? "directory" : "file";

  if (selectionMode === "directory" && type !== "directory") {
    throw new Response("Choose a folder.", { status: 400 });
  }

  if (selectionMode === "file" && type !== "file") {
    throw new Response("Choose a file.", { status: 400 });
  }

  return type;
}

export function browseFiles(
  inputPath: string | null | undefined,
  selectionMode: FileBrowserSelectionMode,
): FileBrowserListing {
  const { rootPath, resolvedPath } = resolveBrowserPath(inputPath);
  const stat = statSync(resolvedPath, { throwIfNoEntry: false });

  if (!stat) {
    throw new Response("Directory not found.", { status: 404 });
  }

  if (!stat.isDirectory()) {
    throw new Response("Choose a directory to browse.", { status: 400 });
  }

  const entries: FileBrowserEntry[] = readdirSync(resolvedPath, { withFileTypes: true })
    .map((entry) => ({
      name: entry.name,
      path: resolve(resolvedPath, entry.name),
      type: entry.isDirectory() ? ("directory" as const) : ("file" as const),
    }))
    .sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === "directory" ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });

  const parentPath = resolvedPath === rootPath ? null : resolve(resolvedPath, "..");

  return {
    rootPath,
    currentPath: resolvedPath,
    parentPath,
    entries,
    selectionMode,
  };
}

export function validateFileSelection(
  inputPath: string | null | undefined,
  selectionMode: FileBrowserSelectionMode,
): FileBrowserSelection {
  const { resolvedPath } = resolveBrowserPath(inputPath);
  const type = assertSelectionType(resolvedPath, selectionMode);

  return {
    path: resolvedPath,
    type,
    name: basename(resolvedPath),
  };
}
