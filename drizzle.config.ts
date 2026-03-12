import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  out: "./drizzle",
  schema: "./app/lib/db/schema.ts",
  dbCredentials: {
    url: process.env.SCRIPTORIUM_DB_PATH?.trim() || ".data/app.db",
  },
  strict: true,
});
