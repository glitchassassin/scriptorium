import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import compression from "compression";
import express from "express";
import morgan from "morgan";
import { createRequestHandler } from "@react-router/express";

import type { RuntimeConfiguration } from "../app/lib/runtime-config.server.js";

function getBuildPaths(packageRoot: string) {
  return {
    packageRoot,
    clientDirectory: path.join(packageRoot, "build/client"),
    clientAssetsDirectory: path.join(packageRoot, "build/client/assets"),
    serverBuildPath: path.join(packageRoot, "build/server/index.js"),
  };
}

function assertBuildExists(paths: ReturnType<typeof getBuildPaths>) {
  if (!existsSync(paths.serverBuildPath) || !existsSync(paths.clientDirectory)) {
    throw new Error(
      "Scriptorium has not been built yet. Run `npm run build` before `npm start`, or use the published package with `npx scriptorium`.",
    );
  }
}

async function loadServerBuild(serverBuildPath: string) {
  return import(pathToFileURL(serverBuildPath).href);
}

function startTailscale(port: number) {
  try {
    execSync(`tailscale serve --bg http://localhost:${port}`, { stdio: "inherit" });
  } catch {
    // tailscale not available - ignore
  }
}

function stopTailscale() {
  try {
    execSync("tailscale serve --https=443 off", { stdio: "ignore" });
  } catch {
    // tailscale not available - ignore
  }
}

export async function serveProductionApp(runtime: RuntimeConfiguration, packageRoot: string) {
  const buildPaths = getBuildPaths(packageRoot);
  assertBuildExists(buildPaths);

  process.env.NODE_ENV = process.env.NODE_ENV ?? "production";

  const build = await loadServerBuild(buildPaths.serverBuildPath);
  const app = express();
  const port = runtime.config.server.port;
  const host = runtime.config.server.host;

  app.disable("x-powered-by");
  app.use(compression());
  app.use(
    "/assets",
    express.static(buildPaths.clientAssetsDirectory, {
      immutable: true,
      maxAge: "1y",
    }),
  );
  app.use(express.static(buildPaths.clientDirectory));
  app.use(morgan("tiny", {
    skip: (req) => req.path === "/session-read-status/ack",
  }));
  app.all(
    "*",
    createRequestHandler({
      build,
      mode: process.env.NODE_ENV,
    }),
  );

  if (runtime.config.network.tailscale) {
    startTailscale(port);
  }

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const httpServer = app.listen(port, host, () => resolve(httpServer));
    httpServer.once("error", reject);
  });

  const networkAddress = Object.values(os.networkInterfaces())
    .flat()
    .find((entry) => String(entry?.family).includes("4") && !entry?.internal)?.address;

  if (networkAddress) {
    process.stdout.write(`[scriptorium] http://${host}:${port} (http://${networkAddress}:${port})\n`);
  } else {
    process.stdout.write(`[scriptorium] http://${host}:${port}\n`);
  }

  let shuttingDown = false;

  const shutdown = () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    if (runtime.config.network.tailscale) {
      stopTailscale();
    }

    server.close((error?: Error) => {
      if (error) {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
      }
    });
  };

  server.once("close", () => {
    if (runtime.config.network.tailscale) {
      stopTailscale();
    }
  });

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
