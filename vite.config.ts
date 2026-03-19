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
    exclude: [
      ".react-router/**",
      "references/**",
      ".opencode/**",
      "node_modules/**",
      "dist/**",
      "build/**",
    ],
    globals: true,
    setupFiles: "./vitest.setup.ts",
  },
});
