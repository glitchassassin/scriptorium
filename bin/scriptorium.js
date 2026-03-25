#!/usr/bin/env node

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

process.env.NODE_ENV = process.env.NODE_ENV ?? "production";

const runtimeCliPath = fileURLToPath(new URL("../build/runtime/server/index.js", import.meta.url));

if (!existsSync(runtimeCliPath)) {
  process.stderr.write(
    "Scriptorium is not built yet. Run `npm run build` before `npm start`, or install the published package.\n",
  );
  process.exit(1);
}

await import(pathToFileURL(path.resolve(runtimeCliPath)).href);
