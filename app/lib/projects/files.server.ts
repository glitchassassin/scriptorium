import { basename, isAbsolute, relative, resolve } from "node:path";
import { readFileSync, readdirSync, statSync } from "node:fs";

import { normalizeAssistantFileReferencePath } from "~/lib/assistant-file-references";
import { getRuntimeConfiguration } from "~/lib/runtime-config/cache.server";
import type {
  FileBrowserContent,
  FileBrowserLineRange,
  FileBrowserListing,
  FileBrowserSelection,
  FileBrowserSelectionMode,
} from "~/lib/projects/types";

const FILE_REFERENCE_CACHE_TTL_MS = 5_000;

type FileReferenceLookupCacheEntry = {
  expiresAt: number;
  result: { path: string } | null;
};

type PendingFileReferenceLookup = {
  basename: string;
  matchKind: "basename" | "suffix";
  matches: string[];
  normalizedLookupPath: string;
};

const fileReferenceLookupCache = new Map<string, FileReferenceLookupCacheEntry>();
const MISSING_FILE_REFERENCE_LOOKUP = Symbol("missing file reference lookup");

// Transcript link resolution may probe several candidate paths in one render pass, so
// cache individual lookup results briefly instead of rescanning the tree each time.

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

export function browseProjectFiles(
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

export function validateProjectFileSelection(
  inputPath: string | null | undefined,
  instanceDirectory: string,
  selectionMode: FileBrowserSelectionMode = "either",
): FileBrowserSelection {
  return validateFileSelection(inputPath, selectionMode, instanceDirectory);
}

export function resolveProjectFileReferences(
  lookupPaths: string[],
  instanceDirectory: string,
): Record<string, { path: string } | null> {
  const normalizedRootPath = resolve(instanceDirectory);
  const results: Record<string, { path: string } | null> = {};
  const lookupsByNormalizedPath = new Map<string, string[]>();
  const uncachedNormalizedLookupPaths: string[] = [];
  const resolvedByNormalizedPath = new Map<string, { path: string } | null>();

  for (const lookupPath of lookupPaths) {
    const normalizedLookupPath = normalizeAssistantFileReferencePath(lookupPath, "inlineCode");

    if (!normalizedLookupPath) {
      results[lookupPath] = null;
      continue;
    }

    const existingLookupPaths = lookupsByNormalizedPath.get(normalizedLookupPath);

    if (existingLookupPaths) {
      existingLookupPaths.push(lookupPath);
      continue;
    }

    lookupsByNormalizedPath.set(normalizedLookupPath, [lookupPath]);

    const cachedResolution = getCachedFileReferenceLookup(normalizedRootPath, normalizedLookupPath);

    if (cachedResolution !== MISSING_FILE_REFERENCE_LOOKUP) {
      resolvedByNormalizedPath.set(normalizedLookupPath, cachedResolution);
      continue;
    }

    uncachedNormalizedLookupPaths.push(normalizedLookupPath);
  }

  if (uncachedNormalizedLookupPaths.length > 0) {
    const resolvedLookups = resolveFileReferenceLookups(normalizedRootPath, uncachedNormalizedLookupPaths);

    for (const [normalizedLookupPath, resolution] of resolvedLookups) {
      setCachedFileReferenceLookup(normalizedRootPath, normalizedLookupPath, resolution);
      resolvedByNormalizedPath.set(normalizedLookupPath, resolution);
    }
  }

  for (const [normalizedLookupPath, sourceLookupPaths] of lookupsByNormalizedPath) {
    const resolvedLookup = resolvedByNormalizedPath.get(normalizedLookupPath) ?? null;

    for (const lookupPath of sourceLookupPaths) {
      results[lookupPath] = resolvedLookup;
    }
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

export function readProjectFile(
  inputPath: string | null | undefined,
  instanceDirectory: string,
): FileBrowserContent {
  return readBrowserFile(inputPath, instanceDirectory);
}

function getCachedFileReferenceLookup(rootPath: string, normalizedLookupPath: string) {
  const cacheKey = buildFileReferenceLookupCacheKey(rootPath, normalizedLookupPath);
  const now = Date.now();
  const cachedEntry = fileReferenceLookupCache.get(cacheKey);

  if (cachedEntry && cachedEntry.expiresAt > now) {
    return cachedEntry.result;
  }

  if (cachedEntry) {
    fileReferenceLookupCache.delete(cacheKey);
  }

  return MISSING_FILE_REFERENCE_LOOKUP;
}

function setCachedFileReferenceLookup(
  rootPath: string,
  normalizedLookupPath: string,
  result: { path: string } | null,
) {
  fileReferenceLookupCache.set(buildFileReferenceLookupCacheKey(rootPath, normalizedLookupPath), {
    expiresAt: Date.now() + FILE_REFERENCE_CACHE_TTL_MS,
    result,
  });
}

function buildFileReferenceLookupCacheKey(rootPath: string, normalizedLookupPath: string) {
  return `${rootPath}\u0000${normalizedLookupPath}`;
}

function resolveFileReferenceLookups(rootPath: string, normalizedLookupPaths: string[]) {
  const results = new Map<string, { path: string } | null>();
  const pendingLookups = new Map<string, PendingFileReferenceLookup>();

  for (const normalizedLookupPath of normalizedLookupPaths) {
    const exactMatch = resolveExactRelativeFilePath(rootPath, normalizedLookupPath);

    if (exactMatch) {
      results.set(normalizedLookupPath, { path: exactMatch });
      continue;
    }

    pendingLookups.set(normalizedLookupPath, {
      basename: basename(normalizedLookupPath),
      matchKind: normalizedLookupPath.includes("/") ? "suffix" : "basename",
      matches: [],
      normalizedLookupPath,
    });
  }

  if (pendingLookups.size === 0) {
    return results;
  }

  collectRelativeFilePathMatches(rootPath, pendingLookups);

  for (const [normalizedLookupPath, lookup] of pendingLookups) {
    const match = lookup.matches.length === 1 ? lookup.matches[0] : null;
    results.set(normalizedLookupPath, match ? { path: match } : null);
  }

  return results;
}

function resolveExactRelativeFilePath(rootPath: string, normalizedLookupPath: string) {
  const resolvedLookupPath = resolve(rootPath, normalizedLookupPath);

  if (!isWithinRoot(rootPath, resolvedLookupPath)) {
    return null;
  }

  const stat = statSync(resolvedLookupPath, { throwIfNoEntry: false });

  if (!stat?.isFile()) {
    return null;
  }

  return relative(rootPath, resolvedLookupPath).replace(/\\/g, "/");
}

function collectRelativeFilePathMatches(
  rootPath: string,
  pendingLookups: Map<string, PendingFileReferenceLookup>,
) {
  const basenameLookups = new Map<string, PendingFileReferenceLookup[]>();
  const suffixLookups = new Map<string, PendingFileReferenceLookup[]>();
  const directories = [rootPath];

  for (const lookup of pendingLookups.values()) {
    const lookupGroup = lookup.matchKind === "basename" ? basenameLookups : suffixLookups;
    const matchingLookups = lookupGroup.get(lookup.basename);

    if (matchingLookups) {
      matchingLookups.push(lookup);
      continue;
    }

    lookupGroup.set(lookup.basename, [lookup]);
  }

  while (directories.length > 0) {
    const directory = directories.pop();

    if (!directory) {
      continue;
    }

    const entries = readDirectoryEntries(directory);

    if (!entries) {
      continue;
    }

    for (const entry of entries) {
      const entryPath = resolve(directory, entry.name);

      if (entry.isDirectory()) {
        directories.push(entryPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const basenameMatches = basenameLookups.get(entry.name);
      const suffixMatches = suffixLookups.get(entry.name);

      if (!basenameMatches && !suffixMatches) {
        continue;
      }

      const relativePath = relative(rootPath, entryPath).replace(/\\/g, "/");

      if (basenameMatches) {
        for (const lookup of basenameMatches) {
          recordFileReferenceLookupMatch(lookup, relativePath);
        }
      }

      if (suffixMatches) {
        for (const lookup of suffixMatches) {
          if (relativePath.endsWith(`/${lookup.normalizedLookupPath}`)) {
            recordFileReferenceLookupMatch(lookup, relativePath);
          }
        }
      }
    }
  }
}

function readDirectoryEntries(directory: string) {
  try {
    return readdirSync(directory, { withFileTypes: true });
  } catch {
    return null;
  }
}

function recordFileReferenceLookupMatch(lookup: PendingFileReferenceLookup, relativePath: string) {
  if (lookup.matches.length >= 2) {
    return;
  }

  lookup.matches.push(relativePath);
}

function parsePositiveLineNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}
