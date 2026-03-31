import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import {
  createConfigSchema,
  createSecretsSchema,
  getRuntimeConfigPaths,
  type OverrideSources,
  type ParsedSecrets,
  type RuntimeConfigPaths,
  type RuntimeConfiguration,
  type RuntimeSecrets,
} from "./schema.server.ts";

const PRIVATE_FILE_MODE = 0o600;

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

function ensureSessionSecret(
  parsedSecrets: ParsedSecrets,
  paths: RuntimeConfigPaths,
  sources: OverrideSources,
): RuntimeSecrets {
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
