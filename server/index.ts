import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import compression from "compression";
import express from "express";
import morgan from "morgan";
import type { ServerBuild } from "react-router";
import { createRequestHandler } from "@react-router/express";

import { initializeRuntimeConfiguration } from "../app/lib/runtime-config/cache.server.ts";
import {
  parseRuntimeCliArgs,
  renderRuntimeConfigurationHelp,
} from "../app/lib/runtime-config/cli.server.ts";
import { runTailscale } from "./tailscale.ts";

import type { RuntimeConfiguration } from "../app/lib/runtime-config/schema.server.ts";

const MODE = process.env.NODE_ENV ?? "production";
const IS_DEV = MODE === "development";

function findPackageRoot() {
  let currentDirectory = path.dirname(fileURLToPath(import.meta.url));

  while (true) {
    if (existsSync(path.join(currentDirectory, "package.json"))) {
      return currentDirectory;
    }

    const parentDirectory = path.dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      throw new Error("Unable to locate package root.");
    }

    currentDirectory = parentDirectory;
  }
}

function getBuildPaths(packageRoot: string) {
  return {
    clientDirectory: path.join(packageRoot, "build/client"),
    clientAssetsDirectory: path.join(packageRoot, "build/client/assets"),
    serverBuildPath: path.join(packageRoot, "build/server/index.js"),
  };
}

function assertBuildExists(packageRoot: string) {
  const paths = getBuildPaths(packageRoot);

  if (!existsSync(paths.serverBuildPath) || !existsSync(paths.clientDirectory)) {
    throw new Error(
      "Scriptorium has not been built yet. Run `npm run build` before `npm start`, or use `npm run dev` for development.",
    );
  }

  return paths;
}

function startTailscale(port: number) {
  try {
    runTailscale(["serve", "--bg", `http://localhost:${port}`], "inherit");
  } catch {
    // tailscale not available - ignore
  }
}

function stopTailscale() {
  try {
    runTailscale(["serve", "--https=443", "off"], "ignore");
  } catch {
    // tailscale not available - ignore
  }
}

function logServerAddresses(host: string, port: number) {
  const networkAddress = Object.values(os.networkInterfaces())
    .flat()
    .find((entry) => String(entry?.family).includes("4") && !entry?.internal)?.address;

  if (networkAddress) {
    process.stdout.write(`[scriptorium] http://${host}:${port} (http://${networkAddress}:${port})\n`);
    return;
  }

  process.stdout.write(`[scriptorium] http://${host}:${port}\n`);
}

async function createApp(runtime: RuntimeConfiguration, packageRoot: string) {
  const app = express();

  app.disable("x-powered-by");
  app.use(compression());
  app.use(morgan("tiny", {
    skip: (req) => req.path === "/session-read-status/ack",
  }));

  if (IS_DEV) {
    const hmrPort = runtime.config.server.port >= 65535
      ? runtime.config.server.port - 1
      : runtime.config.server.port + 1;
    const vite = await import("vite");
    const viteDevServer = await vite.createServer({
      appType: "custom",
      server: {
        hmr: {
          port: hmrPort,
        },
        middlewareMode: true,
      },
    });

    app.use(viteDevServer.middlewares);
    app.use(async (req, res, next) => {
      try {
        const build = await viteDevServer.ssrLoadModule(
          "virtual:react-router/server-build",
        ) as ServerBuild;
        const handler = createRequestHandler({
          build,
          mode: MODE,
        });

        return handler(req, res, next);
      } catch (error) {
        if (error instanceof Error) {
          viteDevServer.ssrFixStacktrace(error);
        }

        return next(error);
      }
    });

    return app;
  }

  const buildPaths = assertBuildExists(packageRoot);
  const build = await import(pathToFileURL(buildPaths.serverBuildPath).href);

  app.use(
    "/assets",
    express.static(buildPaths.clientAssetsDirectory, {
      immutable: true,
      maxAge: "1y",
    }),
  );
  app.use(express.static(buildPaths.clientDirectory));
  app.all(
    "*",
    createRequestHandler({
      build,
      mode: MODE,
    }),
  );

  return app;
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
  const packageRoot = findPackageRoot();
  const app = await createApp(runtime, packageRoot);
  const host = runtime.config.server.host;
  const port = runtime.config.server.port;

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const httpServer = app.listen(port, host, () => resolve(httpServer));
    httpServer.once("error", reject);
  });

  if (runtime.config.network.tailscale) {
    startTailscale(port);
  }

  logServerAddresses(host, port);

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

await main();
