import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    tailwindcss(),
    !process.env.VITEST && reactRouter(),
    tsconfigPaths({
      projects: ["tsconfig.json"],
    }),
  ],
  server: {
    port: 5174,
  },
  test: {
    environment: "jsdom",
    exclude: ["references/**", ".opencode/**", "node_modules/**", "dist/**", "build/**"],
    globals: true,
    setupFiles: "./vitest.setup.ts",
  },
});
