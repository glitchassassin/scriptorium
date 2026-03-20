// @vitest-environment node

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

import {
  buildDocumentationExample,
  collectSchemaDocumentation,
  getRuntimeConfigurationDocumentation,
  parseRuntimeCliArgs,
  resetRuntimeConfigurationCache,
  renderRuntimeConfigurationMarkdown,
  renderRuntimeConfigurationHelp,
  resolveRuntimeConfiguration,
} from "~/lib/runtime-config.server";

const tempDirectories: string[] = [];

function createTempConfigDir() {
  const directory = mkdtempSync(join(tmpdir(), "scriptorium-config-"));
  tempDirectories.push(directory);
  return directory;
}

afterEach(() => {
  resetRuntimeConfigurationCache();

  while (tempDirectories.length) {
    const directory = tempDirectories.pop();

    if (directory) {
      rmSync(directory, { force: true, recursive: true });
    }
  }
});

describe("runtime configuration", () => {
  it("applies cli and env overrides on top of config.yml", () => {
    const configDir = createTempConfigDir();
    const dataDir = createTempConfigDir();

    writeFileSync(join(configDir, "config.yml"), [
      "server:",
      "  host: file-host",
      "  port: 6100",
      "workspace:",
      "  browserRoot: /tmp/workspace",
      "network:",
      "  tailscale: true",
      "",
    ].join("\n"));

    const runtime = resolveRuntimeConfiguration({
      configDir,
      dataDir,
      env: {
        HOST: "env-host",
        OPENCODE_BIN: "custom-opencode",
      },
      cli: {
        port: "6200",
      },
    });

    expect(runtime.config.server.host).toBe("env-host");
    expect(runtime.config.server.port).toBe(6200);
    expect(runtime.config.workspace.browserRoot).toBe("/tmp/workspace");
    expect(runtime.config.network.tailscale).toBe(true);
    expect(runtime.config.opencode.bin).toBe("custom-opencode");
    expect(runtime.config.database.path).toBe(join(dataDir, "app.db"));
  });

  it("initializes config/secrets files and persists session secrets", () => {
    const configDir = createTempConfigDir();

    const first = resolveRuntimeConfiguration({ configDir, env: {} });
    const persistedConfig = readFileSync(join(configDir, "config.yml"), "utf8");
    const persistedSecrets = readFileSync(join(configDir, "secrets.yml"), "utf8");
    const second = resolveRuntimeConfiguration({ configDir, env: {} });

    expect(first.secrets.auth.sessionSecret).toHaveLength(64);
    expect(second.secrets.auth.sessionSecret).toBe(first.secrets.auth.sessionSecret);
    expect(persistedConfig.trim()).not.toHaveLength(0);
    expect(persistedSecrets).toContain("sessionSecret:");
  });

  it("parses cli flags from schema metadata", () => {
    const parsed = parseRuntimeCliArgs([
      "--host=cli-host",
      "--port=6200",
      "--browser-root=/tmp/workspace",
      "--opencode-bin=custom-opencode",
      "--no-tailscale",
      "--db-path=/tmp/scriptorium.db",
      "--config-dir=/tmp/scriptorium-config",
      "--data-dir=/tmp/scriptorium-data",
    ]);

    expect(parsed).toEqual({
      cli: {
        host: "cli-host",
        port: "6200",
        "browser-root": "/tmp/workspace",
        "opencode-bin": "custom-opencode",
        tailscale: false,
        "db-path": "/tmp/scriptorium.db",
      },
      configDir: "/tmp/scriptorium-config",
      dataDir: "/tmp/scriptorium-data",
      help: false,
    });
  });

  it("renders cli help for generated flags", () => {
    const help = renderRuntimeConfigurationHelp();

    expect(help).toContain("Usage: scriptorium [options]");
    expect(help).toContain("--config-dir <path>");
    expect(help).toContain("--data-dir <path>");
    expect(help).toContain("--host <string>");
    expect(help).toContain("--tailscale, --no-tailscale");
  });

  it("collects documentation from schema metadata", () => {
    const docs = getRuntimeConfigurationDocumentation();

    expect(docs.config).toContainEqual(expect.objectContaining({
      path: ["server", "host"],
      type: "string",
      cli: "--host",
      env: "HOST",
      description: "Host interface for the web server.",
      defaultValue: "0.0.0.0",
    }));

    expect(docs.secrets).toContainEqual(expect.objectContaining({
      path: ["auth", "sessionSecret"],
      type: "string",
      env: "SESSION_SECRET",
      description: "Session signing secret.",
    }));
  });

  it("renders markdown and YAML examples for config reference docs", () => {
    const docs = getRuntimeConfigurationDocumentation();
    const configExample = buildDocumentationExample(docs.config, "config");
    const markdown = renderRuntimeConfigurationMarkdown();

    expect(configExample).toContain("server:");
    expect(configExample).toContain("host: 0.0.0.0");
    expect(markdown).toContain("# Configuration Reference");
    expect(markdown).toContain("## config.yml");
    expect(markdown).toContain("`server.host`");
    expect(markdown).toContain("`SESSION_SECRET`");
  });

  it("requires metadata on every documented leaf field", () => {
    expect(() => collectSchemaDocumentation(z.object({ missing: z.string() }))).toThrow(
      "Missing required option metadata.",
    );
  });
});
