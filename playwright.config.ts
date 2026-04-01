import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@playwright/test";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const e2eRoot = path.join(repoRoot, ".data", `e2e-${Date.now()}`);
const e2eDatabasePath = path.join(e2eRoot, "app.db");
const browserRoot = path.join(repoRoot, "tests", "e2e", "fixtures", "workspaces");
const portSeed = Number(process.env.PLAYWRIGHT_PORT_SEED ?? process.pid);
const appPort = Number(process.env.PLAYWRIGHT_APP_PORT ?? 41000 + (portSeed % 1000));
const fakeOpencodePort = Number(process.env.PLAYWRIGHT_FAKE_OPENCODE_PORT ?? 42000 + (portSeed % 1000));
const appUrl = `http://localhost:${appPort}`;
const fakeOpencodeUrl = `http://127.0.0.1:${fakeOpencodePort}`;

const inheritedEnv = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);

process.env.PLAYWRIGHT_APP_PORT = String(appPort);
process.env.PLAYWRIGHT_FAKE_OPENCODE_PORT = String(fakeOpencodePort);
process.env.SCRIPTORIUM_OPENCODE_URL = fakeOpencodeUrl;

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["**/fixtures/**", "**/support/**"],
  testMatch: ["**/*.e2e.ts"],
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: appUrl,
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: `node tests/e2e/support/fake-opencode-server.ts --port ${fakeOpencodePort}`,
      env: {
        ...inheritedEnv,
      },
      reuseExistingServer: false,
      url: `${fakeOpencodeUrl}/__admin/state?directory=%2Fplaywright`,
    },
    {
      command: `node server/index.ts --config-dir ${JSON.stringify(path.join(e2eRoot, "config"))} --data-dir ${JSON.stringify(path.join(e2eRoot, "data"))} --db-path ${JSON.stringify(e2eDatabasePath)} --browser-root ${JSON.stringify(browserRoot)} --host 127.0.0.1 --port ${appPort}`,
      env: {
        ...inheritedEnv,
        NODE_ENV: "development",
        SCRIPTORIUM_BROWSER_ROOT: browserRoot,
        SCRIPTORIUM_DB_PATH: e2eDatabasePath,
        SCRIPTORIUM_OPENCODE_URL: fakeOpencodeUrl,
        SESSION_SECRET: "playwright-session-secret-0123456789abcdef0123456789abcdef",
      },
      reuseExistingServer: false,
      url: appUrl,
    },
  ],
});
