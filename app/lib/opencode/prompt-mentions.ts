import { parseSubagentMention } from "~/lib/opencode/subagents";

export function resolvePromptMentionInput(input: {
  defaultAgent: string;
  hasFileReference: (value: string) => boolean;
  subagents: Iterable<string>;
  text: string;
}) {
  const parsed = parseSubagentMention(input.text, input.subagents);

  if (!parsed || input.hasFileReference(parsed.subagent)) {
    return {
      agent: input.defaultAgent,
      text: input.text,
    };
  }

  return {
    agent: parsed.subagent,
    text: parsed.prompt,
  };
}
