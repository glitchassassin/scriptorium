import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs, type ParseArgsConfig } from "node:util";

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { z } from "zod";

type OptionMetadata = {
  description: string;
  cli?: string;
  env?: string;
};

type OverrideSources = {
  cli?: Record<string, unknown>;
  env?: NodeJS.ProcessEnv;
  configDir?: string;
  dataDir?: string;
};

type RuntimeCliParseResult = {
  cli: Record<string, unknown>;
  configDir?: string;
  dataDir?: string;
  help: boolean;
};

type RuntimeConfigPaths = {
  configDirectory: string;
  dataDirectory: string;
  configFile: string;
  secretsFile: string;
};

export type DocumentationRow = {
  path: string[];
  type: string;
  description: string;
  cli?: string;
  env?: string;
  defaultValue?: unknown;
};

const CONFIG_FILE_NAME = "config.yml";
const SECRETS_FILE_NAME = "secrets.yml";
const PRIVATE_FILE_MODE = 0o600;
const DOCUMENTATION_HOME = "$HOME";
const DOCUMENTATION_CONFIG_DIR = "<scriptorium_config_dir>";
const DOCUMENTATION_DATA_DIR = "<scriptorium_data_dir>";

let cachedRuntimeConfiguration: RuntimeConfiguration | null = null;

function meta<T extends z.ZodTypeAny>(schema: T, metadata: OptionMetadata): T {
  return schema.meta(metadata) as T;
}

function section<TShape extends z.ZodRawShape>(shape: TShape) {
  return z.object(shape).prefault(() =>
    Object.fromEntries(Object.keys(shape).map((key) => [key, undefined])) as z.input<z.ZodObject<TShape>>,
  );
}

function getOptionMetadata(schema: z.ZodTypeAny) {
  const metadata = schema.meta() as OptionMetadata | undefined;

  if (!metadata?.description) {
    throw new Error("Missing required option metadata.");
  }

  return metadata;
}

function override<T extends z.ZodTypeAny>(schema: T, sources: OverrideSources): z.ZodPipe<z.ZodTransform<unknown, unknown>, T> {
  const metadata = getOptionMetadata(schema);

  return z.transform((configValue) => {
    if (metadata.cli) {
      const cliValue = sources.cli?.[metadata.cli];

      if (cliValue !== undefined) {
        return cliValue;
      }
    }

    if (metadata.env) {
      const envValue = sources.env?.[metadata.env];

      if (envValue !== undefined) {
        return envValue;
      }
    }

    return configValue;
  }).pipe(schema);
}

function xdgDirectory(env: NodeJS.ProcessEnv, name: "config" | "data") {
  const home = env.HOME?.trim() || homedir();

  if (name === "config") {
    return resolve(env.XDG_CONFIG_HOME?.trim() || join(home, ".config"), "scriptorium");
  }

  return resolve(env.XDG_DATA_HOME?.trim() || join(home, ".local/share"), "scriptorium");
}

function defaultConfigDirectory(env: NodeJS.ProcessEnv = process.env) {
  return xdgDirectory(env, "config");
}

function defaultDataDirectory(env: NodeJS.ProcessEnv = process.env) {
  return xdgDirectory(env, "data");
}

export function getRuntimeConfigPaths(sources: OverrideSources = {}): RuntimeConfigPaths {
  const configDirectory = resolve(
    sources.configDir ||
      sources.env?.SCRIPTORIUM_CONFIG_DIR?.trim() ||
      defaultConfigDirectory(sources.env),
  );
  const dataDirectory = resolve(
    sources.dataDir ||
      sources.env?.SCRIPTORIUM_DATA_DIR?.trim() ||
      defaultDataDirectory(sources.env),
  );

  return {
    configDirectory,
    dataDirectory,
    configFile: join(configDirectory, CONFIG_FILE_NAME),
    secretsFile: join(configDirectory, SECRETS_FILE_NAME),
  };
}

function getDefaultDatabasePath(sources: OverrideSources) {
  return join(getRuntimeConfigPaths(sources).dataDirectory, "app.db");
}

function createConfigSchema(sources: OverrideSources = {}) {
  const defaultHomeDirectory = sources.env?.HOME?.trim() || homedir();

  return z.object({
    server: section({
      host: override(
        meta(z.string().min(1).default("0.0.0.0"), {
          cli: "host",
          env: "SCRIPTORIUM_HOST",
          description: "Host interface for the web server.",
        }),
        sources,
      ),
      port: override(
        meta(z.coerce.number().int().min(1).max(65535).default(5174), {
          cli: "port",
          env: "SCRIPTORIUM_PORT",
          description: "Port for the web server.",
        }),
        sources,
      ),
    }),
    workspace: section({
      browserRoot: override(
        meta(z.string().min(1).default(defaultHomeDirectory), {
          cli: "browser-root",
          env: "SCRIPTORIUM_BROWSER_ROOT",
          description: "Root directory exposed in the workspace browser.",
        }),
        sources,
      ),
    }),
    opencode: section({
      bin: override(
        meta(z.string().min(1).default("opencode"), {
          cli: "opencode-bin",
          env: "OPENCODE_BIN",
          description: "OpenCode executable name or path.",
        }),
        sources,
      ),
    }),
    network: section({
      tailscale: override(
        meta(z.coerce.boolean().default(false), {
          cli: "tailscale",
          description: "Expose the app with tailscale serve.",
        }),
        sources,
      ),
    }),
    database: section({
      path: override(
        meta(z.string().min(1).default(getDefaultDatabasePath(sources)), {
          cli: "db-path",
          env: "SCRIPTORIUM_DB_PATH",
          description: "Path to the SQLite database file.",
        }),
        sources,
      ),
    }),
  });
}

function createSecretsSchema(sources: OverrideSources = {}) {
  return z.object({
    auth: section({
      sessionSecret: override(
        meta(z.string().min(32).optional(), {
          env: "SESSION_SECRET",
          description: "Session signing secret.",
        }),
        sources,
      ),
    }),
  });
}

type RuntimeConfig = z.infer<ReturnType<typeof createConfigSchema>>;
type ParsedSecrets = z.infer<ReturnType<typeof createSecretsSchema>>;

export type RuntimeSecrets = {
  auth: {
    sessionSecret: string;
  };
};

export type RuntimeConfiguration = {
  config: RuntimeConfig;
  secrets: RuntimeSecrets;
  paths: RuntimeConfigPaths;
};

function readYamlFile(filePath: string) {
  if (!existsSync(filePath)) {
    return {};
  }

  const content = readFileSync(filePath, "utf8");
  const parsed = parseYaml(content);

  if (parsed === null || parsed === undefined) {
    return {};
  }

  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Expected ${filePath} to contain a YAML mapping.`);
  }

  return parsed;
}

function writeYamlFile(filePath: string, value: object) {
  mkdirSync(dirname(filePath), { recursive: true });
  const content = stringifyYaml(value);
  writeFileSync(filePath, content, { encoding: "utf8", mode: PRIVATE_FILE_MODE });

  try {
    chmodSync(filePath, PRIVATE_FILE_MODE);
  } catch {
    // Best-effort only. Some platforms ignore chmod semantics.
  }
}

function ensureRuntimeConfigFiles(paths: RuntimeConfigPaths) {
  mkdirSync(paths.dataDirectory, { recursive: true });

  if (!existsSync(paths.configFile)) {
    writeYamlFile(paths.configFile, {});
  }

  if (!existsSync(paths.secretsFile)) {
    writeYamlFile(paths.secretsFile, {});
  }
}

function ensureSessionSecret(parsedSecrets: ParsedSecrets, paths: RuntimeConfigPaths, sources: OverrideSources): RuntimeSecrets {
  const configuredSecret = parsedSecrets.auth.sessionSecret;

  if (configuredSecret) {
    return {
      auth: {
        sessionSecret: configuredSecret,
      },
    };
  }

  const generatedSecret = randomBytes(32).toString("hex");
  const persistedSecrets = {
    auth: {
      sessionSecret: generatedSecret,
    },
  };

  if (sources.env?.SESSION_SECRET === undefined) {
    writeYamlFile(paths.secretsFile, persistedSecrets);
  }

  return persistedSecrets;
}

export function resolveRuntimeConfiguration(sources: OverrideSources = {}): RuntimeConfiguration {
  const paths = getRuntimeConfigPaths(sources);
  ensureRuntimeConfigFiles(paths);
  const rawConfig = readYamlFile(paths.configFile);
  const rawSecrets = readYamlFile(paths.secretsFile);
  const config = createConfigSchema(sources).parse(rawConfig);
  const secrets = ensureSessionSecret(createSecretsSchema(sources).parse(rawSecrets), paths, sources);

  return { config, secrets, paths };
}

export function getRuntimeConfiguration() {
  if (!cachedRuntimeConfiguration) {
    cachedRuntimeConfiguration = resolveRuntimeConfiguration({ env: process.env });
  }

  return cachedRuntimeConfiguration;
}

export function initializeRuntimeConfiguration(sources: OverrideSources = {}) {
  cachedRuntimeConfiguration = resolveRuntimeConfiguration(sources);
  return cachedRuntimeConfiguration;
}

export function resetRuntimeConfigurationCache() {
  cachedRuntimeConfiguration = null;
}

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

function getCliRows() {
  return getRuntimeConfigurationDocumentation().config.filter((row) => row.cli);
}

function getCliOptionsConfig(): ParseArgsConfig["options"] {
  const options: ParseArgsConfig["options"] = {
    help: {
      type: "boolean",
    },
    "config-dir": {
      type: "string",
    },
    "data-dir": {
      type: "string",
    },
  };

  for (const row of getCliRows()) {
    const flag = row.cli!.slice(2);
    options[flag] = {
      type: row.type === "boolean" ? "boolean" : "string",
    };

    if (row.type === "boolean") {
      options[`no-${flag}`] = {
        type: "boolean",
      };
    }
  }

  return options;
}

export function parseRuntimeCliArgs(args: string[]): RuntimeCliParseResult {
  const parsed = parseArgs({
    args,
    options: getCliOptionsConfig(),
    strict: true,
    allowPositionals: false,
  });
  const values = parsed.values as Record<string, string | boolean | undefined>;

  const cli: Record<string, unknown> = {};

  for (const row of getCliRows()) {
    const flag = row.cli!.slice(2);
    const value = values[flag];

    if (value !== undefined) {
      cli[flag] = value;
      continue;
    }

    if (row.type === "boolean" && values[`no-${flag}`] === true) {
      cli[flag] = false;
    }
  }

  return {
    cli,
    configDir: typeof values["config-dir"] === "string"
      ? values["config-dir"]
      : undefined,
    dataDir: typeof values["data-dir"] === "string"
      ? values["data-dir"]
      : undefined,
    help: values.help === true,
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

export function renderRuntimeConfigurationHelp() {
  const rows = getCliRows();

  return [
    "Usage: scriptorium [options]",
    "",
    "Options:",
    "  --help                  Show this help message",
    "  --config-dir <path>     Use an alternate config directory",
    "  --data-dir <path>       Use an alternate data directory",
    ...rows.map((row) => {
      const flag = row.cli!;
      const typeSuffix = row.type === "boolean" ? "" : ` <${row.type}>`;
      const negated = row.type === "boolean" ? `, --no-${flag.slice(2)}` : "";
      const env = row.env ? ` [env: ${row.env}]` : "";
      return `  ${flag}${typeSuffix}${negated}  ${row.description}${env}`;
    }),
  ].join("\n");
}
