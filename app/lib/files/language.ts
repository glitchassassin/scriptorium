const EXTENSION_MAP: Record<string, string> = {
  js: "javascript",
  cjs: "javascript",
  mjs: "javascript",
  ts: "typescript",
  tsx: "tsx",
  jsx: "jsx",
  json: "json",
  css: "css",
  scss: "scss",
  sass: "scss",
  less: "less",
  html: "markup",
  htm: "markup",
  xml: "markup",
  yml: "yaml",
  yaml: "yaml",
  md: "markdown",
  markdown: "markdown",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  py: "python",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  php: "php",
  c: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  sql: "sql",
  toml: "toml",
  ini: "ini",
  dockerfile: "docker",
};

const SHEBANG_PATTERNS: Array<{ expression: RegExp; language: string }> = [
  { expression: /python/i, language: "python" },
  { expression: /\bruby\b/i, language: "ruby" },
  { expression: /\bnode\b/i, language: "javascript" },
  { expression: /\br?b?ash\b/i, language: "bash" },
  { expression: /\bperl\b/i, language: "perl" },
  { expression: /\b(?:php)\b/i, language: "php" },
];

function getFileBaseName(path: string) {
  const filePath = path.trim().split(/[\\/]/).at(-1) ?? "";
  return filePath.toLowerCase();
}

export function detectCodeLanguage(filePath: string, firstLine?: string): string | null {
  const baseName = getFileBaseName(filePath);

  if (!baseName) {
    return null;
  }

  if (baseName === "dockerfile") {
    return "docker";
  }

  const extension = baseName.includes(".") ? baseName.split(".").at(-1) : "";
  if (extension && extension in EXTENSION_MAP) {
    return EXTENSION_MAP[extension] ?? null;
  }

  if (firstLine?.startsWith("#!")) {
    const shell = SHEBANG_PATTERNS.find((pattern) => pattern.expression.test(firstLine));

    if (shell) {
      return shell.language;
    }
  }

  return null;
}
