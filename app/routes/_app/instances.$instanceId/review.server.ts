import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { data } from "react-router";

import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { getGitChangedFiles, getGitFileDiff, getGitStatusSummary } from "~/lib/instances/git.server";
import {
  getOpencodeSession,
  getOpencodeSessionDiff,
  listOpencodeMessages,
} from "~/lib/instances/opencode.server";
import { getInstanceOrThrow } from "~/lib/instances/runtime.server";
import type { FileTreeStatus, GitChangedFiles } from "~/lib/instances/types";
import type { OpencodeFileDiff } from "~/lib/opencode/events";
import { getLatestVisibleUserMessageDiffs } from "~/lib/opencode/message-helpers";
import {
  type ReviewData,
  type ReviewFileSelection,
  type SessionReviewMode,
} from "~/lib/review";
import { getServerTimingHeaders, makeTimings, time } from "~/lib/server-timing.server";

function notFound(): never {
  throw new Response("Not Found", { status: 404 });
}

export function parseSessionReviewModeOrThrow(mode: string | undefined): SessionReviewMode {
  if (mode === "session" || mode === "recent" || mode === "uncommitted") {
    return mode;
  }

  notFound();
}

function toSnapshotStatus(diff: OpencodeFileDiff): FileTreeStatus {
  if (diff.status === "added") {
    return "A";
  }

  if (diff.status === "deleted") {
    return "D";
  }

  if (!diff.before.length && diff.after.length) {
    return "A";
  }

  if (diff.before.length && !diff.after.length) {
    return "D";
  }

  return "M";
}

function buildSnapshotReviewData(mode: Exclude<SessionReviewMode, "uncommitted">, diffs: OpencodeFileDiff[]): ReviewData {
  return {
    emptyLabel: mode === "session" ? "No session changes are available." : "No recent changes are available.",
    files: diffs.map((diff) => ({
      oldPath: null,
      path: diff.file,
      status: toSnapshotStatus(diff),
    })),
    git: null,
  };
}

function buildUncommittedReviewData(changed: GitChangedFiles, git: ReturnType<typeof getGitStatusSummary>): ReviewData {
  return {
    emptyLabel: "No uncommitted changes.",
    files: changed.isRepository
      ? changed.files.map((file) => ({
        oldPath: file.oldPath,
        path: file.path,
        status: file.changeType === "added" || file.changeType === "untracked"
          ? "A"
          : file.changeType === "deleted"
            ? "D"
            : "M",
      }))
      : [],
    git,
  };
}

function readStoredDiff(before: string, after: string) {
  const dir = mkdtempSync(join(tmpdir(), "scriptorium-review-"));

  try {
    const from = join(dir, "before.txt");
    const to = join(dir, "after.txt");
    writeFileSync(from, before, "utf8");
    writeFileSync(to, after, "utf8");
    const result = spawnSync("git", ["diff", "--no-index", "--no-ext-diff", "--text", "--", from, to], {
      encoding: "utf8",
    });

    if (result.status !== 0 && result.status !== 1) {
      throw new Error(result.stderr || "Failed to build stored diff.");
    }

    return result.stdout;
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

function toStoredSelection(diff: OpencodeFileDiff): ReviewFileSelection {
  const status = toSnapshotStatus(diff);
  const diffSide = status === "D" ? "old" : "new";
  const content = diffSide === "old" ? diff.before : diff.after;
  const diffContent = readStoredDiff(diff.before, diff.after);

  if (!diffContent) {
    return {
      binary: false,
      content,
      mode: "content",
      oldPath: null,
      path: diff.file,
    };
  }

  return {
    binary: false,
    content,
    diffContent,
    diffSide,
    mode: "diff",
    oldPath: null,
    path: diff.file,
  };
}

function getStoredSelection(diffs: OpencodeFileDiff[], path: string | null) {
  if (!path) {
    return null;
  }

  const diff = diffs.find((item) => item.file === path);

  if (!diff) {
    return null;
  }

  // Snapshot-backed review must render the stored before/after content directly.
  // Comparing a historical turn or session against the current workspace would drift
  // as later edits, rebases, or manual changes accumulate.
  return toStoredSelection(diff);
}

export async function loadInstanceUncommittedReviewRouteData({
  instanceId,
  request,
}: {
  instanceId: string;
  request: Request;
}) {
  const timings = makeTimings("review loader");

  await time(() => requireAuthenticatedPasskey(request), {
    desc: "require authenticated passkey",
    timings,
    type: "auth",
  });

  const instance = await time(() => getInstanceOrThrow(instanceId), {
    desc: "get instance",
    timings,
    type: "instance",
  });
  const [git, changed] = await Promise.all([
    time(() => getGitStatusSummary(instance.directory), {
      desc: "get git summary",
      timings,
      type: "git summary",
    }),
    time(() => getGitChangedFiles(instance.directory), {
      desc: "get changed files",
      timings,
      type: "changed files",
    }),
  ]);
  const url = new URL(request.url);
  const path = url.searchParams.get("path");

  let selected: ReviewFileSelection | null = null;
  let selectedError: string | null = null;

  if (path && changed.isRepository) {
    try {
      const result = await time(() => getGitFileDiff(instance.directory, path), {
        desc: "get selected diff",
        timings,
        type: "selected diff",
      });
      selected = result.isRepository ? result : null;
    } catch (error) {
      selectedError = error instanceof Response ? await error.text() : "Failed to load file diff.";
    }
  }

  return data(
    {
      instance,
      mode: "uncommitted" as const,
      review: buildUncommittedReviewData(changed, git),
      selected,
      selectedError,
      selectedPath: path,
    },
    {
      headers: {
        "Server-Timing": timings.toString(),
      },
    },
  );
}

export async function loadSessionReviewRouteData({
  instanceId,
  mode,
  request,
  sessionId,
}: {
  instanceId: string;
  mode: string | undefined;
  request: Request;
  sessionId: string;
}) {
  const reviewMode = parseSessionReviewModeOrThrow(mode);

  if (reviewMode === "uncommitted") {
    return loadInstanceUncommittedReviewRouteData({ instanceId, request });
  }

  const timings = makeTimings("review loader");

  await time(() => requireAuthenticatedPasskey(request), {
    desc: "require authenticated passkey",
    timings,
    type: "auth",
  });

  const instance = await time(() => getInstanceOrThrow(instanceId), {
    desc: "get instance",
    timings,
    type: "instance",
  });
  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  const diffs = reviewMode === "session"
    ? await time(() => getOpencodeSessionDiff(instance, sessionId), {
      desc: "get session diff",
      timings,
      type: "session diff",
    })
    : await time(async () => {
      const [messages, session] = await Promise.all([
        listOpencodeMessages(instance, sessionId),
        getOpencodeSession(instance, sessionId),
      ]);

      return getLatestVisibleUserMessageDiffs(messages, session.revert);
    }, {
      desc: "get recent diff",
      timings,
      type: "recent diff",
    });

  let selected: ReviewFileSelection | null = null;
  let selectedError: string | null = null;

  if (path) {
    try {
      selected = await time(() => Promise.resolve(getStoredSelection(diffs, path)), {
        desc: "get selected diff",
        timings,
        type: "selected diff",
      });
    } catch {
      selectedError = "Failed to load stored diff.";
    }
  }

  return data(
    {
      instance,
      mode: reviewMode,
      review: buildSnapshotReviewData(reviewMode, diffs),
      selected,
      selectedError,
      selectedPath: path,
    },
    {
      headers: {
        "Server-Timing": timings.toString(),
      },
    },
  );
}

export { getServerTimingHeaders };
