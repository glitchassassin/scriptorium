// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

import {
  getGitChangedFiles,
  getGitFileDiff,
} from "~/lib/projects/git.server";

const tempDirectories: string[] = [];

function createGitRepository() {
  const root = mkdtempSync(join(tmpdir(), "scriptorium-git-"));
  tempDirectories.push(root);

  spawnSync("git", ["init", "-q", "--initial-branch", "main"], {
    cwd: root,
    encoding: "utf8",
  });
  spawnSync("git", ["config", "user.name", "Scriptorium Test"], { cwd: root, encoding: "utf8" });
  spawnSync("git", ["config", "user.email", "test@scriptorium.test"], {
    cwd: root,
    encoding: "utf8",
  });

  return root;
}

function createWorkspace() {
  const root = mkdtempSync(join(tmpdir(), "scriptorium-nogit-"));
  tempDirectories.push(root);

  return root;
}

function git(root: string, args: string[]) {
  return spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
  });
}

afterEach(() => {
  while (tempDirectories.length) {
    const directory = tempDirectories.pop();

    if (directory) {
      rmSync(directory, { force: true, recursive: true });
    }
  }
});

describe("git helpers", () => {
  it("parses porcelain status entries with changed, untracked, and renamed files", () => {
    const root = createGitRepository();

    writeFileSync(join(root, "tracked.txt"), "v1\n");
    git(root, ["add", "tracked.txt"]);
    git(root, ["commit", "-qm", "init"]);

    writeFileSync(join(root, "tracked.txt"), "v2\n");
    writeFileSync(join(root, "new.txt"), "new file\n");
    writeFileSync(join(root, "added.txt"), "added file\n");
    mkdirSync(join(root, "dir"), { recursive: true });
    writeFileSync(join(root, "dir/nested-new.ts"), "export const value = 1;\n");
    writeFileSync(join(root, "renamed-from.txt"), "renamed\n");
    git(root, ["add", "renamed-from.txt"]);
    git(root, ["commit", "-qm", "add rename source"]);
    git(root, ["mv", "renamed-from.txt", "renamed-to.txt"]);
    git(root, ["add", "added.txt"]);

    const listing = getGitChangedFiles(root);

    expect(listing.isRepository).toBe(true);
    if (!listing.isRepository) {
      return;
    }

    expect(listing.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "tracked.txt",
          indexStatus: " ",
          workingTreeStatus: "M",
          changeType: "modified",
        }),
        expect.objectContaining({
          path: "new.txt",
          indexStatus: "?",
          workingTreeStatus: "?",
          changeType: "untracked",
        }),
        expect.objectContaining({
          path: "dir/nested-new.ts",
          indexStatus: "?",
          workingTreeStatus: "?",
          changeType: "untracked",
        }),
        expect.objectContaining({
          path: "added.txt",
          indexStatus: "A",
          workingTreeStatus: " ",
          changeType: "added",
        }),
      ]),
    );

    expect(
      listing.files.find((entry: { path: string; oldPath: string | null }) => entry.path === "renamed-to.txt"),
    ).toMatchObject({
      path: "renamed-to.txt",
      oldPath: "renamed-from.txt",
      indexStatus: "R",
      workingTreeStatus: " ",
      changeType: "renamed",
    });
  });

  it("returns file content for untracked files and git diff for tracked changes", () => {
    const root = createGitRepository();

    writeFileSync(join(root, "tracked.txt"), "base\n");
    git(root, ["add", "tracked.txt"]);
    git(root, ["commit", "-qm", "init"]);

    writeFileSync(join(root, "tracked.txt"), "updated\n");
    writeFileSync(join(root, "notes.txt"), "note\n");

    const untracked = getGitFileDiff(root, join(root, "notes.txt"));
    expect(untracked.isRepository).toBe(true);
    if (!untracked.isRepository) {
      throw new Error("expected diff payload");
    }
    expect(untracked).toMatchObject({
      isRepository: true,
      mode: "content",
      content: "note\n",
    });

    const modified = getGitFileDiff(root, join(root, "tracked.txt"));
    expect(modified.isRepository).toBe(true);
    if (!modified.isRepository) {
      throw new Error("expected diff payload");
    }

    if (modified.mode !== "diff") {
      throw new Error("expected tracked file diff");
    }

    expect(modified).toMatchObject({
      isRepository: true,
      mode: "diff",
      content: "updated\n",
      diffSide: "new",
    });

    expect(modified.diffContent).toContain("-base");
    expect(modified.diffContent).toContain("+updated");
  });

  it("returns false for unchanged repos or non-repository directories", () => {
    const root = createWorkspace();
    const listing = getGitChangedFiles(root);

    expect(listing).toEqual({ isRepository: false });
    expect(getGitFileDiff(root, join(root, "notes.txt")).isRepository).toBe(false);
  });
});
