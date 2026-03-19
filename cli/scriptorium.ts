import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  initializeRuntimeConfiguration,
  parseRuntimeCliArgs,
  renderRuntimeConfigurationHelp,
} from "../app/lib/runtime-config.server.js";
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
    env: process.env,
  });

  await serveProductionApp(runtime, getPackageRoot());
}

await main();
