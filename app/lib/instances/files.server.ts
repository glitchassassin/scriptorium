import { basename, isAbsolute, relative, resolve } from "node:path";
import { readFileSync, readdirSync, statSync } from "node:fs";

import { normalizeAssistantFileReferencePath } from "~/lib/assistant-file-references";
import { getRuntimeConfiguration } from "~/lib/runtime-config.server";
import type {
  FileBrowserContent,
  FileBrowserLineRange,
  FileBrowserListing,
  FileBrowserSelection,
  FileBrowserSelectionMode,
} from "~/lib/instances/types";

const FILE_REFERENCE_CACHE_TTL_MS = 5_000;

type FileReferenceManifestCacheEntry = {
  expiresAt: number;
  paths: string[];
};

const fileReferenceManifestCache = new Map<string, FileReferenceManifestCacheEntry>();

// Transcript link resolution may probe several candidate paths in one render pass, so
// cache the workspace manifest briefly instead of rescanning the tree on each lookup.

function getBrowserRoot() {
  return resolve(getRuntimeConfiguration().config.workspace.browserRoot);
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

function collectRelativeFilePaths(rootPath: string, directory: string = rootPath): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const paths: string[] = [];

  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      paths.push(...collectRelativeFilePaths(rootPath, entryPath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    paths.push(relative(rootPath, entryPath).replace(/\\/g, "/"));
  }

  return paths;
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

export function parseSelectedFileLineRange(searchParams: URLSearchParams): FileBrowserLineRange | null {
  const line = parsePositiveLineNumber(searchParams.get("line"));

  if (line === null) {
    return null;
  }

  const endLine = parsePositiveLineNumber(searchParams.get("endLine")) ?? line;

  return { end: endLine, start: line };
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

export function resolveInstanceFileReferences(
  lookupPaths: string[],
  instanceDirectory: string,
): Record<string, { path: string } | null> {
  const manifest = getCachedFileReferenceManifest(instanceDirectory);
  const manifestSet = new Set(manifest);
  const results: Record<string, { path: string } | null> = {};

  for (const lookupPath of lookupPaths) {
    const normalizedLookupPath = normalizeAssistantFileReferencePath(lookupPath, "inlineCode");

    if (!normalizedLookupPath) {
      results[lookupPath] = null;
      continue;
    }

    const exactMatch = manifestSet.has(normalizedLookupPath) ? normalizedLookupPath : null;

    if (exactMatch) {
      results[lookupPath] = { path: exactMatch };
      continue;
    }

    const suffixMatches = manifest.filter((path) => path.endsWith(`/${normalizedLookupPath}`));

    if (suffixMatches.length === 1 && suffixMatches[0]) {
      results[lookupPath] = { path: suffixMatches[0] };
      continue;
    }

    if (!normalizedLookupPath.includes("/")) {
      const basenameMatches = manifest.filter((path) => basename(path) === normalizedLookupPath);

      if (basenameMatches.length === 1 && basenameMatches[0]) {
        results[lookupPath] = { path: basenameMatches[0] };
        continue;
      }
    }

    results[lookupPath] = null;
  }

  return results;
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

function getCachedFileReferenceManifest(rootPath: string) {
  const normalizedRootPath = resolve(rootPath);
  const now = Date.now();
  const cachedEntry = fileReferenceManifestCache.get(normalizedRootPath);

  if (cachedEntry && cachedEntry.expiresAt > now) {
    return cachedEntry.paths;
  }

  const paths = collectRelativeFilePaths(normalizedRootPath);
  fileReferenceManifestCache.set(normalizedRootPath, {
    expiresAt: now + FILE_REFERENCE_CACHE_TTL_MS,
    paths,
  });

  return paths;
}

function parsePositiveLineNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}
