import { describe, expect, it } from "vitest";

import { parseSlashCommand } from "~/lib/opencode/commands";

describe("parseSlashCommand", () => {
  it("parses a single-line slash command", () => {
    expect(parseSlashCommand("/review branch-name")).toEqual({
      arguments: "branch-name",
      command: "review",
    });
  });

  it("preserves multiline command arguments", () => {
    expect(parseSlashCommand("/review branch-name\nextra context")).toEqual({
      arguments: "branch-name\nextra context",
      command: "review",
    });
  });

  it("accepts tab-separated command arguments", () => {
    expect(parseSlashCommand("/review\tbranch-name")).toEqual({
      arguments: "branch-name",
      command: "review",
    });
  });

  it("returns null for normal prompts", () => {
    expect(parseSlashCommand("review this change")).toBeNull();
  });

  it("returns null for a bare slash", () => {
    expect(parseSlashCommand("/")).toBeNull();
  });

  it("returns null for unknown slash commands when given a known list", () => {
    expect(parseSlashCommand("/tmp/build.log", ["review"])).toBeNull();
  });

  it("accepts known slash commands when given a known list", () => {
    expect(parseSlashCommand("/review branch-name", ["review"])).toEqual({
      arguments: "branch-name",
      command: "review",
    });
  });
});
