// @vitest-environment node

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { resetRuntimeConfigurationCache } from "~/lib/runtime-config/cache.server";
import { resolveRuntimeConfiguration } from "~/lib/runtime-config/loader.server";
import { getRuntimeConfigPaths } from "~/lib/runtime-config/schema.server";

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

describe("runtime configuration loader", () => {
  it("applies cli and env overrides on top of config.yml", () => {
    const configDir = createTempConfigDir();
    const dataDir = createTempConfigDir();

    writeFileSync(join(configDir, "config.yml"), [
      "server:",
      "  host: file-host",
      "  port: 6100",
      "workspace:",
      "  browserRoot: /tmp/workspace",
      "opencode:",
      "  url: http://localhost:4200",
      "network:",
      "  tailscale: true",
      "",
    ].join("\n"));

    const runtime = resolveRuntimeConfiguration({
      configDir,
      dataDir,
      env: {
        SCRIPTORIUM_HOST: "env-host",
        OPENCODE_BIN: "custom-opencode",
        SCRIPTORIUM_OPENCODE_URL: "http://localhost:4300",
      },
      cli: {
        "opencode-url": "http://localhost:4400",
        port: "6200",
      },
    });

    expect(runtime.config.server.host).toBe("env-host");
    expect(runtime.config.server.port).toBe(6200);
    expect(runtime.config.workspace.browserRoot).toBe("/tmp/workspace");
    expect(runtime.config.network.tailscale).toBe(true);
    expect(runtime.config.opencode.bin).toBe("custom-opencode");
    expect(runtime.config.opencode.url).toBe("http://localhost:4400");
    expect(runtime.config.database.path).toBe(join(dataDir, "app.db"));
  });

  it("initializes config and secrets files and persists session secrets", () => {
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

  it("uses xdg-style config and data directories by default", () => {
    const paths = getRuntimeConfigPaths({
      env: {
        HOME: "/tmp/home",
      },
    });

    expect(paths.configDirectory).toBe("/tmp/home/.config/scriptorium");
    expect(paths.dataDirectory).toBe("/tmp/home/.local/share/scriptorium");
  });

  it("prefers explicit xdg environment variables for config and data directories", () => {
    const paths = getRuntimeConfigPaths({
      env: {
        HOME: "/tmp/home",
        XDG_CONFIG_HOME: "/tmp/xdg-config",
        XDG_DATA_HOME: "/tmp/xdg-data",
      },
    });

    expect(paths.configDirectory).toBe("/tmp/xdg-config/scriptorium");
    expect(paths.dataDirectory).toBe("/tmp/xdg-data/scriptorium");
  });
});
