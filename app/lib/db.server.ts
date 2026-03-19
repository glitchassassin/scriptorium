import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { eq, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";

import {
  activationCodes,
  authenticationChallenges,
  passkeys,
  registrationChallenges,
  sessions,
} from "~/lib/db/schema";
import { getRuntimeConfiguration } from "~/lib/runtime-config.server";

let sqlite: DatabaseSync | null = null;
let orm: ReturnType<typeof drizzle> | null = null;
const databaseScope = new AsyncLocalStorage<{
  sqlite: DatabaseSync;
  orm: ReturnType<typeof drizzle>;
}>();
const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

function resolveDatabasePath() {
  return resolve(getRuntimeConfiguration().config.database.path);
}

function resetLegacyAuthSchema(database: DatabaseSync) {
  const rows = database
    .prepare(
      `SELECT name FROM sqlite_master WHERE sql LIKE '%passkeys_legacy%' AND type IN ('table', 'index', 'trigger', 'view')`,
    )
    .all() as Array<{ name: string }>;

  if (rows.length === 0) {
    return;
  }

  database.exec(`
    DROP TABLE IF EXISTS activation_codes;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS authentication_challenges;
    DROP TABLE IF EXISTS registration_challenges;
    DROP TABLE IF EXISTS passkeys;
    DROP TABLE IF EXISTS passkeys_legacy;
    DROP TABLE IF EXISTS __drizzle_migrations;
  `);
}

function cleanEphemeralAuthState(database: ReturnType<typeof drizzle>) {
  const now = new Date().toISOString();

  database.delete(registrationChallenges).run();
  database.delete(authenticationChallenges).run();
  database.delete(activationCodes).run();
  database.delete(passkeys).where(eq(passkeys.status, "pending")).run();
  database.delete(sessions).where(lte(sessions.expiresAt, now)).run();
}

function openDatabase(path: string) {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }

  const database = new DatabaseSync(path, {
    enableForeignKeyConstraints: true,
    timeout: 5000,
  });

  database.exec(`PRAGMA journal_mode = WAL;`);
  resetLegacyAuthSchema(database);

  const db = drizzle({ client: database });

  migrate(db, {
    migrationsFolder,
  });

  cleanEphemeralAuthState(db);

  return { sqlite: database, orm: db };
}

function getDatabaseHandles() {
  const scopedHandles = databaseScope.getStore();

  if (scopedHandles) {
    return scopedHandles;
  }

  if (!sqlite || !orm) {
    const opened = openDatabase(resolveDatabasePath());
    sqlite = opened.sqlite;
    orm = opened.orm;
  }

  return { sqlite, orm };
}

export function getOrm() {
  return getDatabaseHandles().orm;
}

export async function withTestDatabase<T>(
  callback: () => Promise<T> | T,
  databasePath = ":memory:",
) {
  const opened = openDatabase(databasePath);

  try {
    return await databaseScope.run(opened, callback);
  } finally {
    opened.sqlite.close();
  }
}
