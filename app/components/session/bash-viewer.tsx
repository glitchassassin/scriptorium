import { useMemo } from "react";

type BashViewerProps = {
  content: string;
  className?: string;
};

type AnsiStyleState = {
  bold: boolean;
  color: string | null;
  backgroundColor: string | null;
};

const ANSI_ESCAPE_PATTERN = /\u001b\[([0-9;]*)m/g;

const ANSI_COLOR_MAP: Record<number, string> = {
  30: "#000000",
  31: "var(--color-accent-red)",
  32: "var(--color-accent-green)",
  33: "var(--color-accent-orange)",
  34: "var(--color-accent-navy)",
  35: "var(--color-accent-violet)",
  36: "var(--color-accent-aqua)",
  37: "#808080",
  90: "#404040",
  91: "var(--color-accent-orange-red)",
  92: "var(--color-accent-chartreuse)",
  93: "var(--color-accent-lemon)",
  94: "var(--color-accent-sky)",
  95: "var(--color-accent-grape)",
  96: "var(--color-accent-aqua)",
  97: "#ffffff",
};

const ANSI_BACKGROUND_MAP: Record<number, string> = {
  40: "#000000",
  41: "var(--color-accent-red)",
  42: "var(--color-accent-green)",
  43: "var(--color-accent-orange)",
  44: "var(--color-accent-navy)",
  45: "var(--color-accent-violet)",
  46: "var(--color-accent-aqua)",
  47: "#c0c0c0",
  100: "#404040",
  101: "var(--color-accent-orange-red)",
  102: "var(--color-accent-chartreuse)",
  103: "var(--color-accent-lemon)",
  104: "var(--color-accent-sky)",
  105: "var(--color-accent-grape)",
  106: "var(--color-accent-aqua)",
  107: "#ffffff",
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function defaultStyleState(): AnsiStyleState {
  return {
    bold: false,
    color: null,
    backgroundColor: null,
  };
}

function applyAnsiCode(state: AnsiStyleState, code: number) {
  if (code === 0) {
    state.bold = false;
    state.color = null;
    state.backgroundColor = null;
    return;
  }

  if (code === 1) {
    state.bold = true;
    return;
  }

  if (code === 22) {
    state.bold = false;
    return;
  }

  if (code === 39) {
    state.color = null;
    return;
  }

  if (code === 49) {
    state.backgroundColor = null;
    return;
  }

  if (ANSI_COLOR_MAP[code]) {
    state.color = ANSI_COLOR_MAP[code];
    return;
  }

  if (ANSI_BACKGROUND_MAP[code]) {
    state.backgroundColor = ANSI_BACKGROUND_MAP[code];
  }
}

function styleToCss(state: AnsiStyleState) {
  const declarations: string[] = [];

  if (state.bold) {
    declarations.push("font-weight:700");
  }

  if (state.color) {
    declarations.push(`color:${state.color}`);
  }

  if (state.backgroundColor) {
    declarations.push(`background-color:${state.backgroundColor}`);
  }

  return declarations.join(";");
}

export function renderAnsiToHtml(content: string) {
  let html = "";
  let cursor = 0;
  let match: RegExpExecArray | null;
  const state = defaultStyleState();

  while ((match = ANSI_ESCAPE_PATTERN.exec(content)) !== null) {
    const plainText = content.slice(cursor, match.index);

    if (plainText) {
      const escaped = escapeHtml(plainText);
      const css = styleToCss(state);
      html += css ? `<span style="${css}">${escaped}</span>` : escaped;
    }

    const codes = match[1]
      ? match[1]
          .split(";")
          .map((value) => Number.parseInt(value, 10))
          .filter((value) => !Number.isNaN(value))
      : [0];

    for (const code of codes) {
      applyAnsiCode(state, code);
    }

    cursor = match.index + match[0].length;
  }

  const tail = content.slice(cursor);

  if (tail) {
    const escaped = escapeHtml(tail);
    const css = styleToCss(state);
    html += css ? `<span style="${css}">${escaped}</span>` : escaped;
  }

  return html;
}

export function BashViewer({ className, content }: BashViewerProps) {
  const html = useMemo(() => renderAnsiToHtml(content), [content]);

  return (
    <pre className={className ?? "whitespace-pre-wrap break-words text-sm leading-6"}>
      <code dangerouslySetInnerHTML={{ __html: html || "&nbsp;" }} />
    </pre>
  );
}
