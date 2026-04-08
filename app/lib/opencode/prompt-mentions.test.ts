import { describe, expect, it } from "vitest";

import { resolvePromptMentionInput } from "~/lib/opencode/prompt-mentions";

describe("resolvePromptMentionInput", () => {
  it("keeps the default agent for normal prompts", () => {
    expect(resolvePromptMentionInput({
      defaultAgent: "draft",
      hasFileReference: () => false,
      subagents: ["explore"],
      text: "hello",
    })).toEqual({
      agent: "draft",
      text: "hello",
    });
  });

  it("switches to a subagent and strips the leading mention", () => {
    expect(resolvePromptMentionInput({
      defaultAgent: "draft",
      hasFileReference: () => false,
      subagents: ["explore"],
      text: "@explore find all css files",
    })).toEqual({
      agent: "explore",
      text: "find all css files",
    });
  });

  it("keeps file-like mentions as plain text when the file exists", () => {
    expect(resolvePromptMentionInput({
      defaultAgent: "draft",
      hasFileReference: (value) => value === "explore",
      subagents: ["explore"],
      text: "@explore",
    })).toEqual({
      agent: "draft",
      text: "@explore",
    });
  });
});
