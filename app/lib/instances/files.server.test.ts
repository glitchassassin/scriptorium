// @vitest-environment node

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { browseFiles, validateFileSelection } from "~/lib/instances/files.server";

const tempDirectories: string[] = [];
const originalBrowserRoot = process.env.SCRIPTORIUM_BROWSER_ROOT;

function createWorkspace() {
  const root = mkdtempSync(join(tmpdir(), "scriptorium-files-"));
  tempDirectories.push(root);

  mkdirSync(join(root, "alpha"));
  mkdirSync(join(root, "beta"));
  writeFileSync(join(root, "notes.txt"), "hello");

  return root;
}

afterEach(() => {
  process.env.SCRIPTORIUM_BROWSER_ROOT = originalBrowserRoot;

  while (tempDirectories.length) {
    const directory = tempDirectories.pop();

    if (directory) {
      rmSync(directory, { force: true, recursive: true });
    }
  }
});

describe("files browser helpers", () => {
  it("lists directories before files", () => {
    const root = createWorkspace();
    process.env.SCRIPTORIUM_BROWSER_ROOT = root;

    const listing = browseFiles(root, "either");

    expect(listing.rootPath).toBe(root);
    expect(listing.parentPath).toBeNull();
    expect(listing.entries.map((entry) => `${entry.type}:${entry.name}`)).toEqual([
      "directory:alpha",
      "directory:beta",
      "file:notes.txt",
    ]);
  });

  it("rejects paths outside the configured root", () => {
    const root = createWorkspace();
    process.env.SCRIPTORIUM_BROWSER_ROOT = root;

    expect(() => browseFiles(join(root, ".."), "either")).toThrowError(Response);
  });

  it("validates file selections against the requested mode", () => {
    const root = createWorkspace();
    process.env.SCRIPTORIUM_BROWSER_ROOT = root;

    expect(validateFileSelection(join(root, "alpha"), "directory")).toMatchObject({
      path: join(root, "alpha"),
      type: "directory",
    });
    expect(() => validateFileSelection(join(root, "notes.txt"), "directory")).toThrowError(Response);
  });
});
