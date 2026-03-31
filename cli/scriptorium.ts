import path from "node:path";
import { fileURLToPath } from "node:url";

import { initializeRuntimeConfiguration } from "../app/lib/runtime-config/cache.server.js";
import {
  parseRuntimeCliArgs,
  renderRuntimeConfigurationHelp,
} from "../app/lib/runtime-config/cli.server.js";
import { serveProductionApp } from "./serve.js";

function getPackageRoot() {
  return path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
}

export async function main(args = process.argv.slice(2)) {
  const parsedCli = parseRuntimeCliArgs(args);

  if (parsedCli.help) {
    process.stdout.write(`${renderRuntimeConfigurationHelp()}\n`);
    return;
  }

  const runtime = initializeRuntimeConfiguration({
    cli: parsedCli.cli,
    configDir: parsedCli.configDir,
    dataDir: parsedCli.dataDir,
    env: process.env,
  });

  await serveProductionApp(runtime, getPackageRoot());
}

await main();
