export function parseSlashCommand(text: string, commands?: Iterable<string>) {
  if (!text.startsWith("/")) {
    return null;
  }

  const lineEnd = text.indexOf("\n");
  const line = lineEnd === -1 ? text : text.slice(0, lineEnd);
  const body = line.slice(1);
  const split = body.search(/\s/);
  const command = (split === -1 ? body : body.slice(0, split)).trim();

  if (!command) {
    return null;
  }

  if (commands) {
    const known = new Set(commands);

    if (!known.has(command)) {
      return null;
    }
  }

  const rest = lineEnd === -1 ? "" : text.slice(lineEnd + 1);
  const head = split === -1 ? "" : body.slice(split).trimStart();
  const args = head + (rest ? `\n${rest}` : "");

  return {
    arguments: args,
    command,
  };
}
