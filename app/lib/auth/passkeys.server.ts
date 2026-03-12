import { and, asc, eq, ne, sql } from "drizzle-orm";

import type { PasskeyRecord, PasskeyStatus } from "~/lib/auth/types";
import { getOrm } from "~/lib/db.server";
import { passkeys } from "~/lib/db/schema";

type PasskeyRow = typeof passkeys.$inferSelect;

function mapPasskey(row: PasskeyRow): PasskeyRecord {
  return {
    id: row.id,
    webauthnUserId: row.webauthnUserId,
    publicKey: row.publicKey,
    counter: row.counter,
    deviceType: row.deviceType,
    backedUp: row.backedUp,
    transports: JSON.parse(row.transportsJson) as string[],
    label: row.label,
    status: row.status as PasskeyStatus,
    createdAt: row.createdAt,
    activatedAt: row.activatedAt,
    revokedAt: row.revokedAt,
  };
}

export function countActivePasskeys() {
  const db = getOrm();
  const row = db
    .select({ count: sql<number>`count(*)` })
    .from(passkeys)
    .where(eq(passkeys.status, "active"))
    .get();

  return row?.count ?? 0;
}

export function listNonRevokedPasskeys() {
  const db = getOrm();
  const rows = db
    .select()
    .from(passkeys)
    .where(ne(passkeys.status, "revoked"))
    .orderBy(asc(passkeys.createdAt))
    .all();

  return rows.map(mapPasskey);
}

export function listActivePasskeys() {
  const db = getOrm();
  const rows = db
    .select()
    .from(passkeys)
    .where(eq(passkeys.status, "active"))
    .orderBy(asc(passkeys.activatedAt), asc(passkeys.createdAt))
    .all();

  return rows.map(mapPasskey);
}

export function getPasskeyById(id: string) {
  const db = getOrm();
  const row = db.select().from(passkeys).where(eq(passkeys.id, id)).get();
  return row ? mapPasskey(row) : null;
}

export function getPasskeyByCredentialId(id: string) {
  return getPasskeyById(id);
}

export function createPendingPasskey(input: {
  id: string;
  webauthnUserId: string;
  publicKey: Uint8Array;
  counter: number;
  deviceType: string;
  backedUp: boolean;
  transports: string[];
  label: string;
}) {
  const db = getOrm();
  const now = new Date().toISOString();

  db.insert(passkeys).values({
    id: input.id,
    webauthnUserId: input.webauthnUserId,
    publicKey: Buffer.from(input.publicKey),
    counter: input.counter,
    deviceType: input.deviceType,
    backedUp: input.backedUp,
    transportsJson: JSON.stringify(input.transports),
    label: input.label,
    status: "pending",
    createdAt: now,
    activatedAt: null,
    revokedAt: null,
  }).run();

  return getPasskeyById(input.id);
}

export function activatePasskey(id: string) {
  const db = getOrm();
  const now = new Date().toISOString();

  db
    .update(passkeys)
    .set({ status: "active", activatedAt: now })
    .where(and(eq(passkeys.id, id), eq(passkeys.status, "pending")))
    .run();

  return getPasskeyById(id);
}

export function updatePasskeyCounter(id: string, counter: number) {
  const db = getOrm();
  db.update(passkeys).set({ counter }).where(eq(passkeys.id, id)).run();
}

export function revokePasskey(id: string) {
  const db = getOrm();
  const now = new Date().toISOString();
  db
    .update(passkeys)
    .set({ status: "revoked", revokedAt: now })
    .where(and(eq(passkeys.id, id), ne(passkeys.status, "revoked")))
    .run();
}
