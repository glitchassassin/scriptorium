import { describe, expect, it } from "vitest";

import { parseOpencodeEvent } from "~/lib/opencode/events";

describe("parseOpencodeEvent", () => {
  it("parses permission asked events", () => {
    const result = parseOpencodeEvent({
      type: "permission.asked",
      properties: {
        id: "permission-1",
        sessionID: "session-1",
        permission: "bash",
        patterns: [],
        metadata: { description: "Run tests" },
        always: [],
        tool: {
          messageID: "message-1",
          callID: "call-1",
        },
      },
    });

    expect(result.kind).toBe("known");
    if (result.kind !== "known") {
      return;
    }

    expect(result.data.type).toBe("permission.asked");
    if (result.data.type !== "permission.asked") {
      return;
    }

    expect(result.data.properties.permission).toBe("bash");
    expect(result.data.properties.tool?.callID).toBe("call-1");
  });

  it("parses permission replied events", () => {
    const result = parseOpencodeEvent({
      type: "permission.replied",
      properties: {
        sessionID: "session-1",
        requestID: "permission-1",
      },
    });

    expect(result.kind).toBe("known");
    if (result.kind !== "known") {
      return;
    }

    expect(result.data.type).toBe("permission.replied");
    if (result.data.type !== "permission.replied") {
      return;
    }

    expect(result.data.properties.requestID).toBe("permission-1");
  });

  it("parses question asked events", () => {
    const result = parseOpencodeEvent({
      type: "question.asked",
      properties: {
        id: "question-1",
        sessionID: "session-1",
        questions: [
          {
            question: "What should I run?",
            header: "Action",
            options: [
              { label: "Tests", description: "Run tests" },
              { label: "Build", description: "Run build" },
            ],
            multiple: true,
          },
        ],
        tool: {
          messageID: "message-1",
          callID: "call-1",
        },
      },
    });

    expect(result.kind).toBe("known");
    if (result.kind !== "known") {
      return;
    }

    expect(result.data.type).toBe("question.asked");
    if (result.data.type !== "question.asked") {
      return;
    }

    expect(result.data.properties.questions[0]?.header).toBe("Action");
    expect(result.data.properties.questions[0]?.multiple).toBe(true);
    expect(result.data.properties.tool?.callID).toBe("call-1");
  });

  it("parses question replied and rejected events", () => {
    const replied = parseOpencodeEvent({
      type: "question.replied",
      properties: {
        sessionID: "session-1",
        requestID: "question-1",
        answers: [["Tests"]],
      },
    });
    const rejected = parseOpencodeEvent({
      type: "question.rejected",
      properties: {
        sessionID: "session-1",
        requestID: "question-1",
      },
    });

    expect(replied.kind).toBe("known");
    if (replied.kind === "known" && replied.data.type === "question.replied") {
      expect(replied.data.properties.answers).toEqual([["Tests"]]);
    }

    expect(rejected.kind).toBe("known");
    if (rejected.kind === "known" && rejected.data.type === "question.rejected") {
      expect(rejected.data.properties.requestID).toBe("question-1");
    }
  });

  it("parses session diff events", () => {
    const result = parseOpencodeEvent({
      type: "session.diff",
      properties: {
        sessionID: "session-1",
        diff: [
          {
            file: "src/app.ts",
            patch: "@@ -1 +1 @@\n-old\n+new",
            additions: 1,
            deletions: 1,
            status: "modified",
          },
        ],
      },
    });

    expect(result.kind).toBe("known");
    if (result.kind !== "known") {
      return;
    }

    expect(result.data.type).toBe("session.diff");
    if (result.data.type !== "session.diff") {
      return;
    }

    expect(result.data.properties.diff[0]?.file).toBe("src/app.ts");
    expect(result.data.properties.diff[0]).toHaveProperty("patch");
  });
});
