type CnObject = Record<string, boolean | null | undefined>;
type CnPart = string | false | null | undefined | CnObject | CnPart[];

function collect(part: CnPart, classes: string[]) {
  if (!part) {
    return;
  }

  if (typeof part === "string") {
    classes.push(part);
    return;
  }

  if (Array.isArray(part)) {
    for (const value of part) {
      collect(value, classes);
    }
    return;
  }

  for (const [key, enabled] of Object.entries(part)) {
    if (enabled) {
      classes.push(key);
    }
  }
}

export function cn(...parts: CnPart[]) {
  const classes: string[] = [];

  for (const part of parts) {
    collect(part, classes);
  }

  return classes.join(" ");
}
