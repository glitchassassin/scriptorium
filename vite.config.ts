import { execSync } from "node:child_process";

import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const APP_PORT = 5174;
const APP_HOST = "0.0.0.0";

export default defineConfig({
  plugins: [
    tailwindcss(),
    !process.env.VITEST && reactRouter(),
    {
      name: "tailscale-serve",
      configureServer(server) {
        server.httpServer?.once("listening", () => {
          try {
            execSync(`tailscale serve --bg http://localhost:${APP_PORT}`, { stdio: "inherit" });
          } catch {
            // tailscale not available - ignore
          }
        });

        server.httpServer?.once("close", () => {
          try {
            execSync("tailscale serve --https=443 off", { stdio: "ignore" });
          } catch {
            // tailscale not available - ignore
          }
        });
      },
    },
    tsconfigPaths({
      projects: ["tsconfig.json"],
    }),
  ],
  server: {
    allowedHosts: true,
    host: APP_HOST,
    port: APP_PORT,
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    exclude: ["references/**", ".opencode/**", "node_modules/**", "dist/**", "build/**"],
    globals: true,
    setupFiles: "./vitest.setup.ts",
  },
});
