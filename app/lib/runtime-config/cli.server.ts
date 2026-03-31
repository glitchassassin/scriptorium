import { parseArgs, type ParseArgsConfig } from "node:util";

import { getRuntimeConfigurationDocumentation } from "./docs.server.ts";
import type { DocumentationRow, RuntimeCliParseResult } from "./schema.server.ts";

function getCliRows() {
  return getRuntimeConfigurationDocumentation().config.filter((row): row is DocumentationRow & { cli: string } => Boolean(row.cli));
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
