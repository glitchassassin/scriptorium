// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  parseSessionReviewModeOrThrow,
  toSnapshotStatus,
  toStoredSelection,
} from "~/routes/_app/projects.$projectId/review.server";

describe("parseSessionReviewModeOrThrow", () => {
  it("accepts supported review modes", () => {
    expect(parseSessionReviewModeOrThrow("session")).toBe("session");
    expect(parseSessionReviewModeOrThrow("recent")).toBe("recent");
    expect(parseSessionReviewModeOrThrow("uncommitted")).toBe("uncommitted");
  });

  it("throws a 404 for unknown review modes", () => {
    expect(() => parseSessionReviewModeOrThrow("archive")).toThrowError(Response);

    try {
      parseSessionReviewModeOrThrow("archive");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(404);
    }
  });
});

describe("toSnapshotStatus", () => {
  it("detects added and deleted files from patch hunks without explicit status", () => {
    expect(toSnapshotStatus({
      additions: 2,
      deletions: 0,
      file: "src/new.ts",
      patch: "@@ -0,0 +1,2 @@\n+one\n+two",
    })).toBe("A");

    expect(toSnapshotStatus({
      additions: 0,
      deletions: 2,
      file: "src/old.ts",
      patch: "@@ -3,2 +0,0 @@\n-old\n-lines",
    })).toBe("D");
  });
});

describe("toStoredSelection", () => {
  it("keeps patch-backed content aligned to original line numbers", () => {
    const selection = toStoredSelection({
      additions: 1,
      deletions: 1,
      file: "src/app.ts",
      patch: [
        "@@ -10,3 +10,3 @@",
        " keep one",
        "-old value",
        "+new value",
        " keep two",
      ].join("\n"),
    });

    expect(selection.mode).toBe("diff");
    if (selection.mode !== "diff") {
      throw new Error("expected diff selection");
    }

    expect(selection.diffSide).toBe("new");
    expect(selection.content.split("\n").slice(0, 12)).toEqual([
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "keep one",
      "new value",
      "keep two",
    ]);
  });

  it("shows the old side for deleted patch-backed files", () => {
    const selection = toStoredSelection({
      additions: 0,
      deletions: 2,
      file: "src/old.ts",
      patch: "@@ -3,2 +0,0 @@\n-old\n-lines",
    });

    expect(selection.mode).toBe("diff");
    if (selection.mode !== "diff") {
      throw new Error("expected diff selection");
    }

    expect(selection.diffSide).toBe("old");
    expect(selection.content.split("\n")).toEqual(["", "", "old", "lines"]);
  });
});
