import { execSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  parseRuntimeCliArgs,
  renderRuntimeConfigurationHelp,
  resolveRuntimeConfiguration,
} from "../app/lib/runtime-config.server";

const parsedCli = parseRuntimeCliArgs(process.argv.slice(2));

if (parsedCli.help) {
  process.stdout.write(`${renderRuntimeConfigurationHelp()}\n`);
  process.exit(0);
}

const runtime = resolveRuntimeConfiguration({
  cli: parsedCli.cli,
  configDir: parsedCli.configDir,
  env: process.env,
});
const port = String(runtime.config.server.port);
const host = runtime.config.server.host;
const serverEntry = fileURLToPath(new URL("../build/server/index.js", import.meta.url));
const childEnv = {
  ...process.env,
  HOST: host,
  OPENCODE_BIN: runtime.config.opencode.bin,
  PORT: port,
  SCRIPTORIUM_BROWSER_ROOT: runtime.config.workspace.browserRoot,
  SCRIPTORIUM_CONFIG_DIR: runtime.paths.directory,
  SCRIPTORIUM_DB_PATH: runtime.config.database.path,
  SESSION_SECRET: runtime.secrets.auth.sessionSecret,
};

const child = spawn(
  process.execPath,
  ["./node_modules/@react-router/serve/dist/bin.js", serverEntry],
  {
    stdio: "inherit",
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: childEnv,
  },
);

if (runtime.config.network.tailscale) {
  try {
    execSync(`tailscale serve --bg http://localhost:${port}`, { stdio: "inherit" });
  } catch {
    // tailscale not available - ignore
  }
}

let shuttingDown = false;

function cleanupAndExit(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (runtime.config.network.tailscale) {
    try {
      execSync("tailscale serve --https=443 off", { stdio: "ignore" });
    } catch {
      // tailscale not available - ignore
    }
  }

  if (child.exitCode === null && !child.killed) {
    child.kill("SIGTERM");
  }

  process.exit(code);
}

child.once("exit", (code, signal) => {
  if (runtime.config.network.tailscale) {
    try {
      execSync("tailscale serve --https=443 off", { stdio: "ignore" });
    } catch {
      // tailscale not available - ignore
    }
  }

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.once("error", () => {
  cleanupAndExit(1);
});

process.once("SIGINT", () => cleanupAndExit(0));
process.once("SIGTERM", () => cleanupAndExit(0));
