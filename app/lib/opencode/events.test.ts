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

  it("parses session diff events", () => {
    const result = parseOpencodeEvent({
      type: "session.diff",
      properties: {
        sessionID: "session-1",
        diff: [
          {
            file: "src/app.ts",
            before: "old",
            after: "new",
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
  });
});
