export function parseSubagentMention(text: string, subagents?: Iterable<string>) {
  if (!text.startsWith("@")) {
    return null;
  }

  const lineEnd = text.indexOf("\n");
  const line = lineEnd === -1 ? text : text.slice(0, lineEnd);
  const body = line.slice(1);
  const split = body.search(/\s/);
  const subagent = (split === -1 ? body : body.slice(0, split)).trim();

  if (!subagent) {
    return null;
  }

  if (subagents) {
    const known = new Set(subagents);

    if (!known.has(subagent)) {
      return null;
    }
  }

  const rest = lineEnd === -1 ? "" : text.slice(lineEnd + 1);
  const head = split === -1 ? "" : body.slice(split).trimStart();
  const prompt = head + (rest ? `\n${rest}` : "");

  return {
    prompt,
    subagent,
  };
}
