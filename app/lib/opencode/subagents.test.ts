import { describe, expect, it } from "vitest";

import { parseSubagentMention } from "~/lib/opencode/subagents";

describe("parseSubagentMention", () => {
  it("parses a single-line subagent mention", () => {
    expect(parseSubagentMention("@explore find files")).toEqual({
      prompt: "find files",
      subagent: "explore",
    });
  });

  it("preserves multiline prompt content", () => {
    expect(parseSubagentMention("@explore find files\nthen summarize them")).toEqual({
      prompt: "find files\nthen summarize them",
      subagent: "explore",
    });
  });

  it("returns null for normal prompts", () => {
    expect(parseSubagentMention("explore the repo")).toBeNull();
  });

  it("returns null for a bare at sign", () => {
    expect(parseSubagentMention("@")).toBeNull();
  });

  it("returns null for unknown subagents when given a known list", () => {
    expect(parseSubagentMention("@src/app.ts", ["explore"])).toBeNull();
  });

  it("accepts known subagents when given a known list", () => {
    expect(parseSubagentMention("@explore find files", ["explore"])).toEqual({
      prompt: "find files",
      subagent: "explore",
    });
  });
});
