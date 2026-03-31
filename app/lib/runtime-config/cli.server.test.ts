// @vitest-environment node

import { describe, expect, it } from "vitest";

import { parseRuntimeCliArgs, renderRuntimeConfigurationHelp } from "~/lib/runtime-config/cli.server";

describe("runtime configuration cli", () => {
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
});
