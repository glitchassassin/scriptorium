import { spawnSync } from "node:child_process";
import { relative } from "node:path";

import { readBrowserFile, resolveBrowserPath } from "~/lib/instances/files.server";
import type {
  GitChangedFile,
  GitChangedFiles,
  GitFileDiffResult,
  GitFileStatusCode,
  GitStatusSummary,
} from "~/lib/instances/types";

type BranchSummary = {
  branch: string | null;
  ahead: number;
  behind: number;
};

const GIT_STATUS_CODE_LENGTH = 2;

function parseBranchLine(line: string): BranchSummary {
  const branchMatch = /^##\s+([^\.\s]+)(?:\.\.\.[^\s]+)?(?:\s+\[(.+)\])?/.exec(line);

  if (!branchMatch) {
    return { branch: null, ahead: 0, behind: 0 };
  }

  let ahead = 0;
  let behind = 0;
  const details = branchMatch[2] ?? "";
  const aheadMatch = /ahead (\d+)/.exec(details);
  const behindMatch = /behind (\d+)/.exec(details);

  if (aheadMatch) {
    ahead = Number(aheadMatch[1]);
  }

  if (behindMatch) {
    behind = Number(behindMatch[1]);
  }

  return {
    branch: branchMatch[1] === "HEAD" ? null : branchMatch[1],
    ahead,
    behind,
  };
}

function normalizeGitStatus(code: string): GitFileStatusCode {
  return (code === " " || code === "M" || code === "A" || code === "D" || code === "R" || code === "C" || code === "T" || code === "U" || code === "?" || code === "!")
    ? (code as GitFileStatusCode)
    : " ";
}

function summarizeChangeType(indexStatus: GitFileStatusCode, workingTreeStatus: GitFileStatusCode) {
  if (indexStatus === "?" && workingTreeStatus === "?") {
    return "untracked" as const;
  }

  if (indexStatus === "U" || workingTreeStatus === "U") {
    return "unmerged" as const;
  }

  if (indexStatus === "R" || workingTreeStatus === "R") {
    return "renamed" as const;
  }

  if (indexStatus === "C" || workingTreeStatus === "C") {
    return "copied" as const;
  }

  if (indexStatus === "T" || workingTreeStatus === "T") {
    return "type-changed" as const;
  }

  if (indexStatus === "D" || workingTreeStatus === "D") {
    return "deleted" as const;
  }

  if (indexStatus === "A" || workingTreeStatus === "A") {
    return "added" as const;
  }

  return "modified" as const;
}

function parsePorcelainEntries(input: string): GitChangedFile[] {
  if (!input) {
    return [];
  }

  const chunks = input.split("\0");
  const changedFiles: GitChangedFile[] = [];

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];

    if (!chunk) {
      continue;
    }

    const status = chunk.slice(0, GIT_STATUS_CODE_LENGTH);
    if (status.length < GIT_STATUS_CODE_LENGTH || chunk[2] !== " ") {
      continue;
    }

    const indexStatus = normalizeGitStatus(status[0] ?? " ");
    const workingTreeStatus = normalizeGitStatus(status[1] ?? " ");
    const fromPath = chunk.slice(GIT_STATUS_CODE_LENGTH + 1);

    if (!fromPath) {
      continue;
    }

    let path = fromPath;
    let oldPath: string | null = null;

    if (indexStatus === "R" || indexStatus === "C" || workingTreeStatus === "R" || workingTreeStatus === "C") {
      const next = chunks[i + 1];
      if (next) {
        oldPath = next;
        i += 1;
      }
    }

    changedFiles.push({
      path,
      oldPath,
      indexStatus,
      workingTreeStatus,
      changeType: summarizeChangeType(indexStatus, workingTreeStatus),
    });
  }

  return changedFiles;
}

function runGit(directory: string, args: string[]) {
  return spawnSync("git", args, {
    cwd: directory,
    encoding: "utf8",
  });
}

function readDiff(directory: string, path: string) {
  const commands = [
    ["diff", "HEAD", "--", path],
    ["diff", "--", path],
    ["diff", "--staged", "--", path],
  ];

  for (const args of commands) {
    const result = runGit(directory, args);

    if (result.status === 0 && result.stdout) {
      return result.stdout;
    }
  }

  return "";
}

function readGitFileAtRevision(directory: string, revision: string, path: string) {
  const result = runGit(directory, ["show", `${revision}:${path}`]);

  if (result.status !== 0) {
    return null;
  }

  return result.stdout;
}

export function getGitChangedFiles(directory: string): GitChangedFiles {
  const result = runGit(directory, ["status", "--short", "--porcelain", "-z", "--untracked-files=all"]);

  if (result.status !== 0) {
    return { isRepository: false };
  }

  return {
    isRepository: true,
    files: parsePorcelainEntries(result.stdout || ""),
  };
}

export function getGitFileDiff(directory: string, inputPath: string): GitFileDiffResult {
  const { resolvedPath } = resolveBrowserPath(inputPath, directory);
  const relativePath = relative(directory, resolvedPath);
  const changedFiles = getGitChangedFiles(directory);

  if (!changedFiles.isRepository) {
    return { isRepository: false };
  }

  const target = changedFiles.files.find(
    (file) => file.path === relativePath || file.oldPath === relativePath,
  );

  if (!target) {
    return { isRepository: false };
  }

  if (target.changeType === "untracked") {
    const file = readBrowserFile(resolvedPath, directory);

    return {
      binary: file.binary,
      isRepository: true,
      path: resolvedPath,
      oldPath: null,
      mode: "content",
      content: file.content,
    };
  }

  const diff = readDiff(directory, relativePath);

  if (!diff) {
    throw new Response("Failed to read git diff.", { status: 400 });
  }

  const diffSide = target.changeType === "deleted" ? "old" : "new";
  const content = diffSide === "new"
    ? readBrowserFile(resolvedPath, directory).content
    : (readGitFileAtRevision(directory, "HEAD", target.oldPath ?? relativePath) ?? "");

  return {
    binary: false,
    isRepository: true,
    path: resolvedPath,
    oldPath: target.oldPath,
    mode: "diff",
    content,
    diffContent: diff,
    diffSide,
  };
}

export function getGitStatusSummary(directory: string): GitStatusSummary {
  const result = spawnSync("git", ["status", "--short", "--branch", "--untracked-files=all"], {
    cwd: directory,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    return { isRepository: false };
  }

  const lines = result.stdout.split(/\r?\n/).filter(Boolean);
  const branch = parseBranchLine(lines[0] ?? "");

  let staged = 0;
  let modified = 0;
  let untracked = 0;

  for (const line of lines.slice(1)) {
    const x = line[0] ?? " ";
    const y = line[1] ?? " ";

    if (x === "?" && y === "?") {
      untracked += 1;
      continue;
    }

    if (x !== " ") {
      staged += 1;
    }

    if (y !== " ") {
      modified += 1;
    }
  }

  return {
    isRepository: true,
    branch: branch.branch,
    ahead: branch.ahead,
    behind: branch.behind,
    staged,
    modified,
    untracked,
    clean: staged === 0 && modified === 0 && untracked === 0,
  };
}
