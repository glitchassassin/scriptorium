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
    expect(parseAssistantFileReference("node_modules/@react-router/express/dist/index.mjs", "inlineCode")).toMatchObject({
      lookupPath: "node_modules/@react-router/express/dist/index.mjs",
    });
  });

  it("collects scoped package file references", () => {
    expect(collectAssistantFileReferenceCandidates([
      "See `node_modules/@react-router/express/dist/index.mjs`.",
      "Also check node_modules/@react-router/express/dist/index.mjs:12.",
    ].join("\n\n"))).toEqual([
      "node_modules/@react-router/express/dist/index.mjs",
    ]);
  });

  it("parses unusual but valid inline-code paths", () => {
    expect(parseAssistantFileReference("node_modules/@react-router/express/dist/index.mjs:12", "inlineCode")).toMatchObject({
      lookupPath: "node_modules/@react-router/express/dist/index.mjs",
      startLine: 12,
      endLine: 12,
    });
    expect(parseAssistantFileReference("node_modules/react-router/dist/development/index-react-server-client.d.mts", "inlineCode")).toMatchObject({
      lookupPath: "node_modules/react-router/dist/development/index-react-server-client.d.mts",
    });
    expect(parseAssistantFileReference(".env", "inlineCode")).toMatchObject({
      lookupPath: ".env",
    });
    expect(parseAssistantFileReference(".gitignore", "inlineCode")).toMatchObject({
      lookupPath: ".gitignore",
    });
    expect(parseAssistantFileReference("foo/bar+baz.ts", "inlineCode")).toMatchObject({
      lookupPath: "foo/bar+baz.ts",
    });
    expect(parseAssistantFileReference("schemas/$schema.json", "inlineCode")).toMatchObject({
      lookupPath: "schemas/$schema.json",
    });
    expect(parseAssistantFileReference("node_modules\\@react-router\\express\\dist\\index.mjs", "inlineCode")).toMatchObject({
      lookupPath: "node_modules/@react-router/express/dist/index.mjs",
    });
  });

  it("collects unusual valid text references", () => {
    expect(collectAssistantFileReferenceCandidates([
      "See node_modules/@react-router/express/dist/index.mjs:12 and types/foo.d.ts,",
      "Also check foo/bar+baz.ts and schemas/$schema.json,",
    ].join("\n\n"))).toEqual([
      "node_modules/@react-router/express/dist/index.mjs",
      "types/foo.d.ts",
      "foo/bar+baz.ts",
      "schemas/$schema.json",
    ]);
  });

  it("builds session file links with line ranges", () => {
    const reference = parseAssistantFileReference("message-markdown.tsx:44-47", "text");

    if (!reference) {
      throw new Error("Expected file reference to parse.");
    }

    expect(buildAssistantFileReferenceHref(
      "/projects/project-1/sessions/session-1/files",
      reference,
      "app/components/session/message-markdown.tsx",
    )).toBe(
      "/projects/project-1/sessions/session-1/files?file=app%2Fcomponents%2Fsession%2Fmessage-markdown.tsx&path=app%2Fcomponents%2Fsession&line=44&endLine=47",
    );
  });
});
