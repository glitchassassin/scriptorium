import { stringify as stringifyYaml } from "yaml";
import { z } from "zod";

import {
  createConfigSchema,
  createSecretsSchema,
  DOCUMENTATION_CONFIG_DIR,
  DOCUMENTATION_DATA_DIR,
  DOCUMENTATION_HOME,
  getOptionMetadata,
  type DocumentationRow,
} from "./schema.server.ts";

function unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodDefault) {
    return unwrapSchema((schema as any)._def.innerType as z.ZodTypeAny);
  }

  if (schema instanceof z.ZodPrefault) {
    return unwrapSchema((schema as any)._def.innerType as z.ZodTypeAny);
  }

  if (schema instanceof z.ZodPipe) {
    return unwrapSchema((schema as any)._def.out as z.ZodTypeAny);
  }

  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return unwrapSchema((schema as any)._def.innerType as z.ZodTypeAny);
  }

  return schema;
}

function getDefaultValue(schema: z.ZodTypeAny): unknown {
  if (schema instanceof z.ZodDefault) {
    return schema._def.defaultValue;
  }

  if (schema instanceof z.ZodPipe) {
    return getDefaultValue((schema as any)._def.out as z.ZodTypeAny);
  }

  if (schema instanceof z.ZodPrefault) {
    return getDefaultValue((schema as any)._def.innerType as z.ZodTypeAny);
  }

  return undefined;
}

function getTypeName(schema: z.ZodTypeAny): string {
  const unwrapped = unwrapSchema(schema);

  if (unwrapped instanceof z.ZodString) {
    return "string";
  }

  if (unwrapped instanceof z.ZodNumber) {
    return "number";
  }

  if (unwrapped instanceof z.ZodBoolean) {
    return "boolean";
  }

  if (unwrapped instanceof z.ZodEnum) {
    return "enum";
  }

  return "unknown";
}

export function collectSchemaDocumentation(schema: z.ZodTypeAny, path: string[] = []): DocumentationRow[] {
  const unwrapped = unwrapSchema(schema);

  if (unwrapped instanceof z.ZodObject) {
    return Object.entries(unwrapped.shape).flatMap(([key, child]) =>
      collectSchemaDocumentation(child, [...path, key]),
    );
  }

  const metadata = schema instanceof z.ZodPipe
    ? getOptionMetadata((schema as any)._def.out as z.ZodTypeAny)
    : getOptionMetadata(schema);

  return [{
    path,
    type: getTypeName(schema),
    description: metadata.description,
    cli: metadata.cli ? `--${metadata.cli}` : undefined,
    env: metadata.env,
    defaultValue: getDefaultValue(schema),
  }];
}

export function getRuntimeConfigurationDocumentation() {
  const sources = {
    env: {
      APPDATA: "C:/Users/you/AppData/Roaming",
      HOME: "/path/to/home",
      LOCALAPPDATA: "C:/Users/you/AppData/Local",
      XDG_CONFIG_HOME: "/path/to/home/.config",
      XDG_DATA_HOME: "/path/to/home/.local/share",
    },
    cli: {},
  };

  return {
    config: collectSchemaDocumentation(createConfigSchema(sources)),
    secrets: collectSchemaDocumentation(createSecretsSchema(sources)),
  };
}

function stringifyDefaultValue(value: unknown) {
  if (value === undefined) {
    return "";
  }

  return `\`${String(normalizeDocumentationValue(value))}\``;
}

function normalizeDocumentationValue(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  return value
    .replaceAll("/path/to/home/.config/scriptorium", DOCUMENTATION_CONFIG_DIR)
    .replaceAll("/path/to/home/.local/share/scriptorium", DOCUMENTATION_DATA_DIR)
    .replaceAll("/path/to/home", DOCUMENTATION_HOME);
}

function escapeTableCell(value: string | undefined) {
  return (value || "").replaceAll("|", "\\|");
}

function setNestedValue(target: Record<string, unknown>, path: string[], value: unknown) {
  let current = target;

  for (const segment of path.slice(0, -1)) {
    const existing = current[segment];

    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      current[segment] = {};
    }

    current = current[segment] as Record<string, unknown>;
  }

  current[path.at(-1)!] = value;
}

function getExampleValue(row: DocumentationRow, section: "config" | "secrets") {
  if (row.defaultValue !== undefined) {
    return normalizeDocumentationValue(row.defaultValue);
  }

  if (section === "secrets") {
    return "<generated on first run or set via env>";
  }

  return `<set ${row.path.join(".")}>`;
}

export function buildDocumentationExample(rows: DocumentationRow[], section: "config" | "secrets") {
  const result: Record<string, unknown> = {};

  for (const row of rows) {
    setNestedValue(result, row.path, getExampleValue(row, section));
  }

  return stringifyYaml(result).trim();
}

function renderDocumentationTable(rows: DocumentationRow[]) {
  const lines = [
    "| Key | Type | Default | CLI | Env | Description |",
    "| --- | --- | --- | --- | --- | --- |",
  ];

  for (const row of rows) {
    lines.push(`| \`${row.path.join(".")}\` | ${row.type} | ${escapeTableCell(stringifyDefaultValue(row.defaultValue))} | ${escapeTableCell(row.cli ? `\`${row.cli}\`` : "")} | ${escapeTableCell(row.env ? `\`${row.env}\`` : "")} | ${escapeTableCell(row.description)} |`);
  }

  return lines.join("\n");
}

export function renderRuntimeConfigurationMarkdown() {
  const documentation = getRuntimeConfigurationDocumentation();

  return [
    "# Configuration Reference",
    "",
    "Scriptorium reads non-sensitive settings from `config.yml` and secrets from `secrets.yml` in its per-user config directory.",
    "CLI flags override environment variables, which override YAML values, which override schema defaults.",
    "The configuration directory can be overridden with `--config-dir <path>` or `SCRIPTORIUM_CONFIG_DIR`.",
    "The data directory can be overridden with `--data-dir <path>` or `SCRIPTORIUM_DATA_DIR`.",
    "On startup, Scriptorium creates missing config files and writes a generated `auth.sessionSecret` when needed. The SQLite database is opened lazily, and pending migrations run when the database is first opened.",
    "",
    `| Platform | ${DOCUMENTATION_CONFIG_DIR} | ${DOCUMENTATION_DATA_DIR} |`,
    "| --- | --- | --- |",
    "| macOS | `$XDG_CONFIG_HOME/scriptorium` or `~/.config/scriptorium` | `$XDG_DATA_HOME/scriptorium` or `~/.local/share/scriptorium` |",
    "| Linux | `$XDG_CONFIG_HOME/scriptorium` or `~/.config/scriptorium` | `$XDG_DATA_HOME/scriptorium` or `~/.local/share/scriptorium` |",
    "| Windows | `%XDG_CONFIG_HOME%\\scriptorium` or `%USERPROFILE%\\.config\\scriptorium` | `%XDG_DATA_HOME%\\scriptorium` or `%USERPROFILE%\\.local\\share\\scriptorium` |",
    "",
    `Examples use \`${DOCUMENTATION_CONFIG_DIR}\` and \`${DOCUMENTATION_DATA_DIR}\` as shorthand for Scriptorium's per-user config/data directories and \`${DOCUMENTATION_HOME}\` for the user's home directory.`,
    "",
    "## config.yml",
    "",
    "```yaml",
    buildDocumentationExample(documentation.config, "config"),
    "```",
    "",
    renderDocumentationTable(documentation.config),
    "",
    "## secrets.yml",
    "",
    "```yaml",
    buildDocumentationExample(documentation.secrets, "secrets"),
    "```",
    "",
    renderDocumentationTable(documentation.secrets),
    "",
  ].join("\n");
}
