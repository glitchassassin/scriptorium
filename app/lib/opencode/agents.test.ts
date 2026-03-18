import { describe, expect, it } from "vitest";

import type { OpencodeMessageWithParts } from "~/lib/opencode/events";
import { getInitialAgent, getNextAgent, getSelectableAgents } from "~/lib/opencode/agents";

function createUserMessage(id: string, createdAt: number, agent?: string): OpencodeMessageWithParts {
  return {
    info: {
      id,
      sessionID: "session-1",
      role: "user",
      time: { created: createdAt },
      ...(agent ? { agent } : {}),
    },
    parts: [],
  };
}

describe("opencode agent helpers", () => {
  it("filters selectable agents to visible non-subagents", () => {
    const agents = [
      { name: "code", mode: "subagent" as const },
      { name: "analysis", mode: "primary" as const },
      { name: "copilot", mode: "all" as const },
      { name: "compaction", mode: "primary" as const, hidden: true },
    ];

    expect(getSelectableAgents(agents).map((agent) => agent.name)).toEqual(["analysis", "copilot"]);
  });

  it("defaults to the most recent valid agent from session history", () => {
    const agents = [
      { name: "analysis", mode: "primary" as const },
      { name: "copilot", mode: "all" as const },
      { name: "draft", mode: "subagent" as const },
    ];

    const messages: OpencodeMessageWithParts[] = [
      createUserMessage("m-1", 300, "analysis"),
      createUserMessage("m-2", 100, "draft"),
      createUserMessage("m-3", 200, "copilot"),
    ];

    expect(getInitialAgent(messages, agents)).toBe("analysis");
  });

  it("cycles to the next selectable agent", () => {
    const agents = [
      { name: "analysis", mode: "primary" as const },
      { name: "draft", mode: "subagent" as const },
      { name: "copilot", mode: "all" as const },
    ];

    expect(getNextAgent("analysis", agents)).toBe("copilot");
    expect(getNextAgent("copilot", agents)).toBe("analysis");
  });

  it("starts at the first selectable agent when current is not usable", () => {
    const agents = [
      { name: "analysis", mode: "primary" as const },
      { name: "copilot", mode: "all" as const },
    ];

    expect(getNextAgent(null, agents)).toBe("analysis");
    expect(getNextAgent("draft", agents)).toBe("analysis");
  });

  it("falls back to the primary selectable agent when history is not usable", () => {
    const agents = [
      { name: "compaction", mode: "primary" as const, hidden: true },
      { name: "analysis", mode: "primary" as const },
      { name: "copilot", mode: "all" as const },
      { name: "draft", mode: "subagent" as const },
    ];

    const messages: OpencodeMessageWithParts[] = [
      createUserMessage("m-1", 100, "draft"),
      createUserMessage("m-2", 200),
    ];

    expect(getInitialAgent(messages, agents)).toBe("analysis");
  });

  it("ignores hidden primary agents from recent history", () => {
    const agents = [
      { name: "analysis", mode: "primary" as const },
      { name: "compaction", mode: "primary" as const, hidden: true },
      { name: "copilot", mode: "all" as const },
    ];

    const messages: OpencodeMessageWithParts[] = [
      createUserMessage("m-1", 100, "analysis"),
      createUserMessage("m-2", 300, "compaction"),
      createUserMessage("m-3", 200, "copilot"),
    ];

    expect(getInitialAgent(messages, agents)).toBe("copilot");
  });

  it("returns null when no selectable agent is available", () => {
    const agents = [{ name: "draft", mode: "subagent" as const }];

    const messages: OpencodeMessageWithParts[] = [createUserMessage("m-1", 100, "draft")];

    expect(getInitialAgent(messages, agents)).toBeNull();
    expect(getNextAgent("draft", agents)).toBeNull();
  });
});
