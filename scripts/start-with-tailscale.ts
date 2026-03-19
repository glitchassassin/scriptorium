import { execSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { getRuntimeConfiguration } from "../app/lib/runtime-config.server";

const runtime = getRuntimeConfiguration();
const port = String(runtime.config.server.port);
const host = runtime.config.server.host;
const serverEntry = fileURLToPath(new URL("../build/server/index.js", import.meta.url));

const child = spawn(
  process.execPath,
  ["./node_modules/@react-router/serve/dist/bin.js", serverEntry],
  {
    stdio: "inherit",
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: {
      ...process.env,
      PORT: port,
      HOST: host,
    },
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
