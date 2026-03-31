import { sql } from "drizzle-orm";
import {
  blob,
  check,
  index,
  integer,
  primaryKey,
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

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    directory: text("directory").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_projects_directory").on(table.directory)],
);

export const sessionReadStatuses = sqliteTable(
  "session_read_statuses",
  {
    sessionId: text("session_id").notNull(),
    lastReadAt: text("last_read_at").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId] }),
    index("idx_session_read_statuses_updated_at").on(table.updatedAt),
  ],
);

export const modelUsages = sqliteTable(
  "model_usages",
  {
    projectId: text("project_id").notNull(),
    sessionId: text("session_id").notNull(),
    providerId: text("provider_id").notNull(),
    modelId: text("model_id").notNull(),
    variant: text("variant"),
    usedAt: text("used_at").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.sessionId, table.providerId, table.modelId] }),
    index("idx_model_usages_project_used_at").on(table.projectId, table.usedAt),
    index("idx_model_usages_session").on(table.projectId, table.sessionId),
    index("idx_model_usages_used_at").on(table.usedAt),
  ],
);
