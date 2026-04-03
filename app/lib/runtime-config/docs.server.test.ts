// @vitest-environment node

import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  buildDocumentationExample,
  collectSchemaDocumentation,
  getRuntimeConfigurationDocumentation,
  renderRuntimeConfigurationMarkdown,
} from "~/lib/runtime-config/docs.server";

describe("runtime configuration docs", () => {
  it("collects documentation from schema metadata", () => {
    const docs = getRuntimeConfigurationDocumentation();

    expect(docs.config).toContainEqual(expect.objectContaining({
      path: ["server", "host"],
      type: "string",
      cli: "--host",
      env: "SCRIPTORIUM_HOST",
      description: "Host interface for the web server.",
      defaultValue: "0.0.0.0",
    }));

    expect(docs.secrets).toContainEqual(expect.objectContaining({
      path: ["auth", "sessionSecret"],
      type: "string",
      env: "SESSION_SECRET",
      description: "Session signing secret. If unset, Scriptorium generates one on first run and writes it to `secrets.yml`.",
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
