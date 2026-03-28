import { describe, expect, it } from "vitest";

import {
  buildAssistantFileReferenceHref,
  collectAssistantFileReferenceCandidates,
  parseAssistantFileReference,
} from "~/lib/assistant-file-references";

describe("assistant file references", () => {
  it("collects markdown text and inline-code file candidates while skipping fenced code and links", () => {
    expect(collectAssistantFileReferenceCandidates([
      "See app/components/session/message-markdown.tsx:44 and `docs/e-ink style guide.md`.",
      "[Already linked](https://example.com/app/components/session/message-markdown.tsx)",
      "```ts",
      "app/components/session/message-markdown.tsx",
      "```",
    ].join("\n\n"))).toEqual([
      "app/components/session/message-markdown.tsx",
      "docs/e-ink style guide.md",
    ]);
  });

  it("parses supported line reference syntaxes", () => {
    expect(parseAssistantFileReference("@src/app.ts:12-18", "text")).toMatchObject({
      endLine: 18,
      lookupPath: "src/app.ts",
      startLine: 12,
    });
    expect(parseAssistantFileReference("src/app.ts:12:5", "text")).toMatchObject({
      endLine: 12,
      lookupPath: "src/app.ts",
      startLine: 12,
    });
    expect(parseAssistantFileReference("src/app.ts#L10C2", "text")).toMatchObject({
      endLine: 10,
      lookupPath: "src/app.ts",
      startLine: 10,
    });
  });

  it("rejects invalid text references while allowing spaces in inline code references", () => {
    expect(parseAssistantFileReference("../src/app.ts", "text")).toBeNull();
    expect(parseAssistantFileReference("docs/e-ink style guide.md", "text")).toBeNull();
    expect(parseAssistantFileReference("docs/e-ink style guide.md", "inlineCode")).toMatchObject({
      lookupPath: "docs/e-ink style guide.md",
    });
  });

  it("builds session file links with line ranges", () => {
    const reference = parseAssistantFileReference("message-markdown.tsx:44-47", "text");

    if (!reference) {
      throw new Error("Expected file reference to parse.");
    }

    expect(buildAssistantFileReferenceHref(
      "/instances/instance-1/sessions/session-1/files",
      reference,
      "app/components/session/message-markdown.tsx",
    )).toBe(
      "/instances/instance-1/sessions/session-1/files?file=app%2Fcomponents%2Fsession%2Fmessage-markdown.tsx&path=app%2Fcomponents%2Fsession&line=44&endLine=47",
    );
  });
});
