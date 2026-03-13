import { describe, expect, it } from "vitest";

import { parseUnifiedDiff, parseUnifiedDiffHunks } from "~/lib/files/diff";

describe("parseUnifiedDiff", () => {
  it("tracks unified diff line numbers across hunks", () => {
    const lines = parseUnifiedDiff([
      "diff --git a/app.txt b/app.txt",
      "index 1a2b3c..4d5e6f 100644",
      "--- a/app.txt",
      "+++ b/app.txt",
      "@@ -1,3 +1,3 @@",
      " context",
      "-old",
      "+new line",
      "@@ -5,2 +5,3 @@",
      " next",
      "-removed",
      "+added",
    ].join("\n"));

    expect(lines[0]).toMatchObject({ kind: "meta", marker: "" });
    expect(lines[5]).toMatchObject({ kind: "context", content: "context", oldLine: 1, newLine: 1, marker: " " });
    expect(lines[6]).toMatchObject({ kind: "deletion", content: "old", oldLine: 2, newLine: null, marker: "-" });
    expect(lines[7]).toMatchObject({ kind: "addition", content: "new line", oldLine: null, newLine: 2, marker: "+" });
    expect(lines[9]).toMatchObject({ kind: "context", content: "next", oldLine: 5, newLine: 5, marker: " " });
    expect(lines[10]).toMatchObject({ kind: "deletion", content: "removed", oldLine: 6, marker: "-" });
    expect(lines[11]).toMatchObject({ kind: "addition", content: "added", newLine: 6, marker: "+" });
  });

  it("extracts hunks with old and new ranges", () => {
    const hunks = parseUnifiedDiffHunks([
      "diff --git a/app.txt b/app.txt",
      "index 1a2b3c..4d5e6f 100644",
      "--- a/app.txt",
      "+++ b/app.txt",
      "@@ -1,2 +1,3 @@",
      " line one",
      "-line two",
      "+line two changed",
      "+line three",
    ].join("\n"));

    expect(hunks).toHaveLength(1);
    expect(hunks[0]).toMatchObject({
      oldStart: 1,
      oldCount: 2,
      newStart: 1,
      newCount: 3,
    });
    expect(hunks[0]?.lines).toEqual([
      expect.objectContaining({ kind: "context", content: "line one", oldLine: 1, newLine: 1 }),
      expect.objectContaining({ kind: "deletion", content: "line two", oldLine: 2, newLine: null }),
      expect.objectContaining({ kind: "addition", content: "line two changed", oldLine: null, newLine: 2 }),
      expect.objectContaining({ kind: "addition", content: "line three", oldLine: null, newLine: 3 }),
    ]);
  });
});
