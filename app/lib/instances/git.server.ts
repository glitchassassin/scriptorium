import { spawnSync } from "node:child_process";

import type { GitStatusSummary } from "~/lib/instances/types";

function parseBranchLine(line: string) {
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

export function getGitStatusSummary(directory: string): GitStatusSummary {
  const result = spawnSync("git", ["status", "--short", "--branch"], {
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
