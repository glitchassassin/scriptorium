// @vitest-environment node

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  browseFiles,
  browseProjectFiles,
  parseSelectedFileLineRange,
  readBrowserFile,
  readProjectFile,
  resolveProjectFileReferences,
  validateFileSelection,
  validateProjectFileSelection,
} from "~/lib/projects/files.server";
import { resetRuntimeConfigurationCache } from "~/lib/runtime-config/cache.server";

const tempDirectories: string[] = [];
const originalBrowserRoot = process.env.SCRIPTORIUM_BROWSER_ROOT;

function createWorkspace() {
  const root = mkdtempSync(join(tmpdir(), "scriptorium-files-"));
  tempDirectories.push(root);

  mkdirSync(join(root, "alpha"));
  mkdirSync(join(root, "beta"));
  mkdirSync(join(root, "app", "components", "session"), { recursive: true });
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(join(root, "notes.txt"), "hello");
  writeFileSync(join(root, "alpha", "project.txt"), "project file");
  writeFileSync(join(root, "alpha", "duplicate.tsx"), "alpha duplicate");
  writeFileSync(join(root, "beta", "duplicate.tsx"), "beta duplicate");
  writeFileSync(join(root, "app", "components", "session", "message-markdown.tsx"), "component");
  writeFileSync(join(root, "docs", "e-ink style guide.md"), "guide");

  return root;
}

afterEach(() => {
  resetRuntimeConfigurationCache();
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
      "directory:app",
      "directory:beta",
      "directory:docs",
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

  it("supports project-root browsing and reading with path containment checks", () => {
    const root = createWorkspace();
    const instanceRoot = join(root, "alpha");

    const listing = browseProjectFiles(null, instanceRoot, "either");
    expect(listing.currentPath).toBe(instanceRoot);
    expect(listing.parentPath).toBeNull();

    expect(() => browseProjectFiles(join(root, ".."), instanceRoot, "either")).toThrowError(Response);
    expect(() => validateProjectFileSelection(join(root, "notes.txt"), instanceRoot, "file")).toThrowError(Response);

    const file = readBrowserFile(join(root, "notes.txt"), root);
    expect(file.name).toBe("notes.txt");
    expect(file.content).toBe("hello");

    const nestedFile = readProjectFile(join(instanceRoot, "project.txt"), instanceRoot);
    expect(nestedFile.path).toBe(join(instanceRoot, "project.txt"));
    expect(nestedFile.content).toBe("project file");
  });

  it("parses linked file line ranges from search params", () => {
    expect(parseSelectedFileLineRange(new URLSearchParams("line=12"))).toEqual({ end: 12, start: 12 });
    expect(parseSelectedFileLineRange(new URLSearchParams("line=8&endLine=11"))).toEqual({ end: 11, start: 8 });
    expect(parseSelectedFileLineRange(new URLSearchParams("line=0&endLine=11"))).toBeNull();
    expect(parseSelectedFileLineRange(new URLSearchParams("endLine=11"))).toBeNull();
  });

  it("resolves exact, unique suffix, basename, and spaced inline-code references", () => {
    const root = createWorkspace();

    expect(resolveProjectFileReferences([
      "app/components/session/message-markdown.tsx",
      "components/session/message-markdown.tsx",
      "message-markdown.tsx",
      "docs/e-ink style guide.md",
    ], root)).toEqual({
      "app/components/session/message-markdown.tsx": { path: "app/components/session/message-markdown.tsx" },
      "components/session/message-markdown.tsx": { path: "app/components/session/message-markdown.tsx" },
      "message-markdown.tsx": { path: "app/components/session/message-markdown.tsx" },
      "docs/e-ink style guide.md": { path: "docs/e-ink style guide.md" },
    });
  });

  it("leaves ambiguous or invalid references unresolved", () => {
    const root = createWorkspace();

    expect(resolveProjectFileReferences([
      "duplicate.tsx",
      "../notes.txt",
      "/tmp/outside.txt",
    ], root)).toEqual({
      "duplicate.tsx": null,
      "../notes.txt": null,
      "/tmp/outside.txt": null,
    });
  });

  it("resolves exact dependency paths without promoting ambiguous basenames", () => {
    const root = createWorkspace();

    mkdirSync(join(root, "app", "widgets"), { recursive: true });
    mkdirSync(join(root, "frontend", "node_modules", "pkg"), { recursive: true });
    writeFileSync(join(root, "app", "widgets", "widget.tsx"), "app widget");
    writeFileSync(join(root, "frontend", "node_modules", "pkg", "widget.tsx"), "package widget");
    writeFileSync(join(root, "frontend", "node_modules", "pkg", "third-party.ts"), "third party");

    expect(resolveProjectFileReferences([
      "frontend/node_modules/pkg/third-party.ts",
      "widget.tsx",
    ], root)).toEqual({
      "frontend/node_modules/pkg/third-party.ts": { path: "frontend/node_modules/pkg/third-party.ts" },
      "widget.tsx": null,
    });
  });
});
