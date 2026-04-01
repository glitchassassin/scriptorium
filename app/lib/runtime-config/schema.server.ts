import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { z } from "zod";

export type OptionMetadata = {
  description: string;
  cli?: string;
  env?: string;
};

export type OverrideSources = {
  cli?: Record<string, unknown>;
  env?: NodeJS.ProcessEnv;
  configDir?: string;
  dataDir?: string;
};

export type RuntimeCliParseResult = {
  cli: Record<string, unknown>;
  configDir?: string;
  dataDir?: string;
  help: boolean;
};

export type RuntimeConfigPaths = {
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

export const CONFIG_FILE_NAME = "config.yml";
export const SECRETS_FILE_NAME = "secrets.yml";
export const DOCUMENTATION_HOME = "$HOME";
export const DOCUMENTATION_CONFIG_DIR = "<scriptorium_config_dir>";
export const DOCUMENTATION_DATA_DIR = "<scriptorium_data_dir>";

export function meta<T extends z.ZodTypeAny>(schema: T, metadata: OptionMetadata): T {
  return schema.meta(metadata) as T;
}

export function section<TShape extends z.ZodRawShape>(shape: TShape) {
  return z.object(shape).prefault(() =>
    Object.fromEntries(Object.keys(shape).map((key) => [key, undefined])) as z.input<z.ZodObject<TShape>>,
  );
}

export function getOptionMetadata(schema: z.ZodTypeAny) {
  const metadata = schema.meta() as OptionMetadata | undefined;

  if (!metadata?.description) {
    throw new Error("Missing required option metadata.");
  }

  return metadata;
}

export function override<T extends z.ZodTypeAny>(
  schema: T,
  sources: OverrideSources,
): z.ZodPipe<z.ZodTransform<unknown, unknown>, T> {
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

export function createConfigSchema(sources: OverrideSources = {}) {
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
      url: override(
        meta(z.string().url().optional(), {
          cli: "opencode-url",
          env: "SCRIPTORIUM_OPENCODE_URL",
          description: "OpenCode server base URL. When set, Scriptorium connects to this server instead of launching its own shared OpenCode process.",
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

export function createSecretsSchema(sources: OverrideSources = {}) {
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

export type RuntimeConfig = z.infer<ReturnType<typeof createConfigSchema>>;
export type ParsedSecrets = z.infer<ReturnType<typeof createSecretsSchema>>;

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
