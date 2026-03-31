import { spawn, type ChildProcess } from "node:child_process";

import { getRuntimeConfiguration } from "~/lib/runtime-config/cache.server";

const STOP_TIMEOUT_MS = 5000;
const START_TIMEOUT_MS = 15000;
const LISTEN_PATTERN = /opencode server listening on http:\/\/[^:]+:(\d+)/;

function getOpencodeServeEnv() {
  const env = { ...process.env };

  delete env.NODE_ENV;

  return env;
}

export type ManagedOpencodeServeProcess = {
  child: ChildProcess;
  ready: Promise<number>;
  stop: () => Promise<void>;
};

type SpawnOpencodeServeOptions = {
  cwd: string;
  label: string;
};

function getOpencodeBinary() {
  return getRuntimeConfiguration().config.opencode.bin;
}

export function spawnOpencodeServeProcess(options: SpawnOpencodeServeOptions): ManagedOpencodeServeProcess {
  const child = spawn(getOpencodeBinary(), ["serve"], {
    cwd: options.cwd,
    env: getOpencodeServeEnv(),
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
      process.stderr.write(`[opencode:${options.label}] ${chunk}`);
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
