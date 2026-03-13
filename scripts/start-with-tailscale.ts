import { execSync, spawn } from "node:child_process";

const port = process.env.PORT?.trim() || "5174";
const host = process.env.HOST?.trim() || "0.0.0.0";

const child = spawn(
  "npx",
  ["react-router-serve", "./build/server/index.js"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: port,
      HOST: host,
    },
  },
);

try {
  execSync(`tailscale serve --bg http://localhost:${port}`, { stdio: "inherit" });
} catch {
  // tailscale not available - ignore
}

let shuttingDown = false;

function cleanupAndExit(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  try {
    execSync("tailscale serve --https=443 off", { stdio: "ignore" });
  } catch {
    // tailscale not available - ignore
  }

  if (child.exitCode === null && !child.killed) {
    child.kill("SIGTERM");
  }

  process.exit(code);
}

child.once("exit", (code, signal) => {
  try {
    execSync("tailscale serve --https=443 off", { stdio: "ignore" });
  } catch {
    // tailscale not available - ignore
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
