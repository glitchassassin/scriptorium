import { sql } from "drizzle-orm";
import {
  blob,
  check,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const passkeys = sqliteTable(
  "passkeys",
  {
    id: text("id").primaryKey(),
    webauthnUserId: text("webauthn_user_id").notNull(),
    publicKey: blob("public_key", { mode: "buffer" }).notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: integer("backed_up", { mode: "boolean" }).notNull(),
    transportsJson: text("transports_json").notNull(),
    label: text("label").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    activatedAt: text("activated_at"),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    index("idx_passkeys_status").on(table.status),
    check(
      "passkeys_status_check",
      sql`${table.status} in ('pending', 'active', 'revoked')`,
    ),
  ],
);

export const registrationChallenges = sqliteTable("registration_challenges", {
  id: text("id").primaryKey(),
  challenge: text("challenge").notNull(),
  label: text("label").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const authenticationChallenges = sqliteTable("authentication_challenges", {
  id: text("id").primaryKey(),
  challenge: text("challenge").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const activationCodes = sqliteTable(
  "activation_codes",
  {
    id: text("id").primaryKey(),
    passkeyId: text("passkey_id")
      .notNull()
      .references(() => passkeys.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
    consumedAt: text("consumed_at"),
    attempts: integer("attempts").notNull().default(0),
  },
  (table) => [index("idx_activation_codes_passkey_id").on(table.passkeyId)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    passkeyId: text("passkey_id")
      .notNull()
      .references(() => passkeys.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
  },
  (table) => [index("idx_sessions_expires_at").on(table.expiresAt)],
);
