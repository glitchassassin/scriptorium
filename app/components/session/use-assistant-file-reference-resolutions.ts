import { useEffect, useMemo, useState } from "react";

import {
  collectAssistantFileReferenceCandidates,
  type AssistantFileReferenceResolution,
} from "~/lib/assistant-file-references";

type ResolveFileReferencesResponse = {
  results: Record<string, AssistantFileReferenceResolution | null>;
};

type ResolutionCacheEntry = {
  expiresAt: number | null;
  value: AssistantFileReferenceResolution | null;
};

const NEGATIVE_CACHE_TTL_MS = 5_000;

const resolutionCache = new Map<string, ResolutionCacheEntry>();
const pendingResolutionKeys = new Set<string>();
const cacheListeners = new Set<() => void>();

// Negative entries expire so a later render can retry them, but memoized transcript messages
// still will not promote plain text into links just because the workspace changed underneath
// them. That gap is acceptable until we add an invalidation signal for assistant file refs.

export function useAssistantFileReferenceResolutions(instanceId: string | undefined, markdownText: string) {
  const [cacheRevision, setCacheRevision] = useState(0);
  const lookupPaths = useMemo(() => collectAssistantFileReferenceCandidates(markdownText), [markdownText]);
  const lookupKey = lookupPaths.join("\u0000");

  useEffect(() => {
    const listener = () => setCacheRevision((current) => current + 1);
    cacheListeners.add(listener);

    return () => {
      cacheListeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!instanceId || lookupPaths.length === 0) {
      return;
    }

    const missingLookupPaths = lookupPaths.filter((lookupPath) => {
      const cacheKey = buildCacheKey(instanceId, lookupPath);
      const cachedResolution = resolutionCache.get(cacheKey);

      if (cachedResolution && !hasCacheEntryExpired(cachedResolution)) {
        return false;
      }

      if (cachedResolution) {
        resolutionCache.delete(cacheKey);
      }

      if (pendingResolutionKeys.has(cacheKey)) {
        return false;
      }

      pendingResolutionKeys.add(cacheKey);
      return true;
    });

    if (missingLookupPaths.length === 0) {
      return;
    }

    void fetch(buildResolveUrl(instanceId, missingLookupPaths))
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to resolve file references: ${response.status}`);
        }

        return (await response.json()) as ResolveFileReferencesResponse;
      })
      .then((payload) => {
        for (const lookupPath of missingLookupPaths) {
          const cacheKey = buildCacheKey(instanceId, lookupPath);
          const resolvedValue = payload.results[lookupPath] ?? null;

          pendingResolutionKeys.delete(cacheKey);
          resolutionCache.set(cacheKey, {
            expiresAt: resolvedValue ? null : Date.now() + NEGATIVE_CACHE_TTL_MS,
            value: resolvedValue,
          });
        }

        emitCacheUpdate();
      })
      .catch(() => {
        for (const lookupPath of missingLookupPaths) {
          const cacheKey = buildCacheKey(instanceId, lookupPath);
          pendingResolutionKeys.delete(cacheKey);
          resolutionCache.set(cacheKey, {
            expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS,
            value: null,
          });
        }

        emitCacheUpdate();
      });
  }, [instanceId, lookupKey, lookupPaths]);

  return useMemo(() => {
    if (!instanceId || lookupPaths.length === 0) {
      return new Map<string, AssistantFileReferenceResolution | null>();
    }

    return new Map(
      lookupPaths.map((lookupPath) => {
        const cachedResolution = resolutionCache.get(buildCacheKey(instanceId, lookupPath));

        if (!cachedResolution || hasCacheEntryExpired(cachedResolution)) {
          return [lookupPath, null] as const;
        }

        return [lookupPath, cachedResolution.value] as const;
      }),
    );
  }, [cacheRevision, instanceId, lookupPaths]);
}

function hasCacheEntryExpired(entry: ResolutionCacheEntry) {
  return entry.expiresAt !== null && entry.expiresAt <= Date.now();
}

function buildCacheKey(instanceId: string, lookupPath: string) {
  return `${instanceId}:${lookupPath}`;
}

function buildResolveUrl(instanceId: string, lookupPaths: string[]) {
  const searchParams = new URLSearchParams();

  for (const lookupPath of lookupPaths) {
    searchParams.append("candidate", lookupPath);
  }

  return `/instances/${instanceId}/file-references/resolve?${searchParams.toString()}`;
}

function emitCacheUpdate() {
  for (const listener of cacheListeners) {
    listener();
  }
}
