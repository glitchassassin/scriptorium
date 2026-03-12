import { createHash, randomBytes } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import type { PendingEnrollment } from "~/lib/auth/types";
import { getOrm } from "~/lib/db.server";
import { activationCodes, passkeys } from "~/lib/db/schema";

const ACTIVATION_CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function normalizeCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function hashCode(code: string) {
  return createHash("sha256").update(normalizeCode(code)).digest("hex");
}

function generateCode() {
  const raw = randomBytes(4).toString("hex").toUpperCase();
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function getActivationCodeTimeToLiveMs() {
  return ACTIVATION_CODE_TTL_MS;
}

export function createActivationCode(passkeyId: string) {
  const db = getOrm();
  const id = randomBytes(16).toString("hex");
  const plainTextCode = generateCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ACTIVATION_CODE_TTL_MS).toISOString();

  db.insert(activationCodes).values({
    id,
    passkeyId,
    codeHash: hashCode(plainTextCode),
    expiresAt,
    createdAt: now.toISOString(),
    consumedAt: null,
    attempts: 0,
  }).run();

  return {
    enrollmentId: id,
    code: plainTextCode,
    expiresAt,
  };
}

export function getPendingEnrollment(enrollmentId: string) {
  const db = getOrm();
  const row = db
    .select({
      enrollmentId: activationCodes.id,
      passkeyId: activationCodes.passkeyId,
      label: passkeys.label,
      status: passkeys.status,
      expiresAt: activationCodes.expiresAt,
      createdAt: activationCodes.createdAt,
      consumedAt: activationCodes.consumedAt,
    })
    .from(activationCodes)
    .innerJoin(passkeys, eq(passkeys.id, activationCodes.passkeyId))
    .where(eq(activationCodes.id, enrollmentId))
    .get();

  if (!row) {
    return null;
  }

  const pendingEnrollment: PendingEnrollment = {
    enrollmentId: row.enrollmentId,
    passkeyId: row.passkeyId,
    label: row.label,
    status: row.status as PendingEnrollment["status"],
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    consumedAt: row.consumedAt,
  };

  return pendingEnrollment;
}

export function consumeActivationCode(enrollmentId: string, code: string) {
  const db = getOrm();
  const now = new Date().toISOString();

  return db.transaction((tx) => {
    const row = tx
      .select()
      .from(activationCodes)
      .where(eq(activationCodes.id, enrollmentId))
      .get();

    if (!row) {
      throw new Error("That enrollment could not be found.");
    }

    if (row.consumedAt) {
      throw new Error("That confirmation code has already been used.");
    }

    if (row.expiresAt <= now) {
      throw new Error("That confirmation code has expired.");
    }

    if (row.attempts >= MAX_ATTEMPTS) {
      throw new Error("Too many confirmation attempts. Register the passkey again.");
    }

    if (hashCode(code) !== row.codeHash) {
      tx
        .update(activationCodes)
        .set({ attempts: sql`${activationCodes.attempts} + 1` })
        .where(eq(activationCodes.id, enrollmentId))
        .run();
      throw new Error("The confirmation code was not recognized.");
    }

    tx
      .update(activationCodes)
      .set({ consumedAt: now })
      .where(and(eq(activationCodes.id, enrollmentId), eq(activationCodes.passkeyId, row.passkeyId)))
      .run();

    return row.passkeyId;
  });
}
