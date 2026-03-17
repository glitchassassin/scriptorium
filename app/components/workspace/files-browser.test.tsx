import { describe, expect, it } from "vitest";

import { formatLineReference, formatWorkspacePath } from "~/components/workspace/files-browser";

describe("files browser references", () => {
  it("formats workspace-relative single-line references", () => {
    expect(formatLineReference(formatWorkspacePath("/repo", "/repo/src/app.ts"), { start: 12, end: 12 })).toBe(
      "@src/app.ts:12",
    );
  });

  it("formats workspace-relative line ranges", () => {
    expect(formatLineReference(formatWorkspacePath("/repo", "/repo/src/app.ts"), { start: 18, end: 12 })).toBe(
      "@src/app.ts:12-18",
    );
  });
});
