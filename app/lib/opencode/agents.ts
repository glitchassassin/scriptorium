import type { OpencodeAgent, OpencodeMessageWithParts } from "~/lib/opencode/events";

const isSelectable = (agent: OpencodeAgent) => agent.mode !== "subagent" && agent.hidden !== true;
const isVisibleSubagent = (agent: OpencodeAgent) => agent.mode === "subagent" && agent.hidden !== true;

export function getSelectableAgents(agents: OpencodeAgent[]): OpencodeAgent[] {
  return agents.filter(isSelectable);
}

export function getVisibleSubagents(agents: OpencodeAgent[]): OpencodeAgent[] {
  return agents.filter(isVisibleSubagent);
}

export function getNextAgent(current: string | null, agents: OpencodeAgent[]): string | null {
  const selectable = getSelectableAgents(agents);

  if (!selectable.length) {
    return null;
  }

  const currentIndex = selectable.findIndex((agent) => agent.name === current);

  if (currentIndex < 0) {
    return selectable[0].name;
  }

  return selectable[(currentIndex + 1) % selectable.length].name;
}

export function getInitialAgent(messages: OpencodeMessageWithParts[], agents: OpencodeAgent[]): string | null {
  const selectable = getSelectableAgents(agents);
  if (!selectable.length) {
    return null;
  }

  const usableNames = new Set(selectable.map((agent) => agent.name));

  const recent = messages.reduce<OpencodeMessageWithParts | null>((latest, message) => {
    const name = message.info.agent;

    if (typeof name !== "string" || !usableNames.has(name)) {
      return latest;
    }

    if (!latest) {
      return message;
    }

    return message.info.time.created > latest.info.time.created ? message : latest;
  }, null);

  if (recent?.info.agent) {
    return recent.info.agent;
  }

  return selectable[0].name;
}
