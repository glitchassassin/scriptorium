import { homedir } from "node:os";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { readFileSync, readdirSync, statSync } from "node:fs";

import type {
  FileBrowserContent,
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

function listDirectoryEntries(directory: string) {
  return readdirSync(directory, { withFileTypes: true })
    .map((entry) => ({
      name: entry.name,
      path: resolve(directory, entry.name),
      type: entry.isDirectory() ? ("directory" as const) : ("file" as const),
    }))
    .sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === "directory" ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
}

function buildBrowserListing(
  rootPath: string,
  resolvedPath: string,
  selectionMode: FileBrowserSelectionMode,
): FileBrowserListing {
  return {
    rootPath,
    currentPath: resolvedPath,
    parentPath: resolvedPath === rootPath ? null : resolve(resolvedPath, ".."),
    entries: listDirectoryEntries(resolvedPath),
    selectionMode,
  };
}

function resolveBrowserPathForRoot(inputPath: string | null | undefined, rootPath: string) {
  const value = inputPath?.trim() || rootPath;
  const resolvedPath = isAbsolute(value) ? resolve(value) : resolve(rootPath, value);

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

function assertFile(path: string) {
  const stat = statSync(path);

  if (!stat.isFile()) {
    throw new Response("Choose a file.", { status: 400 });
  }
}

export function resolveBrowserPath(
  inputPath: string | null | undefined,
  rootPath: string = getBrowserRoot(),
) {
  return resolveBrowserPathForRoot(inputPath, rootPath);
}

export function browseFiles(
  inputPath: string | null | undefined,
  selectionMode: FileBrowserSelectionMode,
  rootPath: string = getBrowserRoot(),
): FileBrowserListing {
  const { resolvedPath } = resolveBrowserPathForRoot(inputPath, rootPath);
  const stat = statSync(resolvedPath, { throwIfNoEntry: false });

  if (!stat) {
    throw new Response("Directory not found.", { status: 404 });
  }

  if (!stat.isDirectory()) {
    throw new Response("Choose a directory to browse.", { status: 400 });
  }

  return buildBrowserListing(resolve(rootPath), resolvedPath, selectionMode);
}

export function browseInstanceFiles(
  inputPath: string | null | undefined,
  instanceDirectory: string,
  selectionMode: FileBrowserSelectionMode,
): FileBrowserListing {
  return browseFiles(inputPath, selectionMode, instanceDirectory);
}

export function validateFileSelection(
  inputPath: string | null | undefined,
  selectionMode: FileBrowserSelectionMode,
  rootPath: string = getBrowserRoot(),
): FileBrowserSelection {
  const { resolvedPath } = resolveBrowserPathForRoot(inputPath, rootPath);
  const type = assertSelectionType(resolvedPath, selectionMode);

  return {
    path: resolvedPath,
    type,
    name: basename(resolvedPath),
  };
}

export function validateInstanceFileSelection(
  inputPath: string | null | undefined,
  instanceDirectory: string,
  selectionMode: FileBrowserSelectionMode = "either",
): FileBrowserSelection {
  return validateFileSelection(inputPath, selectionMode, instanceDirectory);
}

export function readBrowserFile(
  inputPath: string | null | undefined,
  rootPath: string,
): FileBrowserContent {
  const { resolvedPath } = resolveBrowserPathForRoot(inputPath, rootPath);
  const stat = statSync(resolvedPath, { throwIfNoEntry: false });

  if (!stat) {
    throw new Response("File not found.", { status: 404 });
  }

  assertFile(resolvedPath);

  const buffer = readFileSync(resolvedPath);
  const binary = buffer.includes(0) || buffer.byteLength > 1024 * 1024;

  return {
    path: resolvedPath,
    name: basename(resolvedPath),
    content: binary ? "" : buffer.toString("utf8"),
    binary,
  };
}

export function readInstanceFile(
  inputPath: string | null | undefined,
  instanceDirectory: string,
): FileBrowserContent {
  return readBrowserFile(inputPath, instanceDirectory);
}
