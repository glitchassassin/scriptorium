import { ChildProcess, spawn } from "node:child_process";

import type { InstanceRecord } from "~/lib/instances/types";

const STOP_TIMEOUT_MS = 5000;
const START_TIMEOUT_MS = 15000;
const LISTEN_PATTERN = /opencode server listening on http:\/\/[^:]+:(\d+)/;

export type ManagedInstanceProcess = {
  child: ChildProcess;
  ready: Promise<number>;
  stop: () => Promise<void>;
};

function getOpencodeBinary() {
  return process.env.OPENCODE_BIN?.trim() || "opencode";
}

export function spawnInstanceProcess(instance: InstanceRecord): ManagedInstanceProcess {
  const child = spawn(getOpencodeBinary(), ["serve"], {
    cwd: instance.directory,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const ready = new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out while starting Opencode."));
    }, START_TIMEOUT_MS);
    let output = "";

    function finish(port: number) {
      clearTimeout(timeout);
      resolve(port);
    }

    function fail(message: string) {
      clearTimeout(timeout);
      reject(new Error(message));
    }

    function parse(chunk: string) {
      output += chunk;

      const match = output.match(LISTEN_PATTERN);

      if (match) {
        finish(Number(match[1]));
      }
    }

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", parse);
    child.stderr?.on("data", (chunk: string) => {
      process.stderr.write(`[opencode:${instance.name}] ${chunk}`);
      parse(chunk);
    });
    child.once("error", (error) => fail(error.message));
    child.once("exit", (code, signal) => {
      fail(`Process exited with code ${code ?? "unknown"}${signal ? ` (${signal})` : ""}`);
    });
  });

  async function stop() {
    if (child.exitCode !== null || child.killed) {
      return;
    }

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, STOP_TIMEOUT_MS);

      child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });

      if (!child.kill("SIGTERM")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  }

  return { child, ready, stop };
}
