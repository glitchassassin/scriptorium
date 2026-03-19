import { randomBytes } from "node:crypto";

import { and, eq, gt, lte } from "drizzle-orm";
import { createCookie } from "react-router";

import { getOrm } from "~/lib/db.server";
import { sessions } from "~/lib/db/schema";
import { getRuntimeConfiguration } from "~/lib/runtime-config.server";
import type { SessionRecord } from "~/lib/auth/types";

const SESSION_COOKIE_NAME = "scriptorium_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let sessionCookie: ReturnType<typeof createCookie> | null = null;

type SessionRow = typeof sessions.$inferSelect;

function mapSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    passkeyId: row.passkeyId,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    lastSeenAt: row.lastSeenAt,
  };
}

function getSessionCookie() {
  if (!sessionCookie) {
    sessionCookie = createCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      maxAge: SESSION_TTL_MS / 1000,
      path: "/",
      sameSite: "lax",
      secrets: [getRuntimeConfiguration().secrets.auth.sessionSecret],
      secure: process.env.NODE_ENV === "production",
    });
  }

  return sessionCookie;
}

export async function getSessionId(request: Request) {
  const cookieHeader = request.headers.get("Cookie");
  return (await getSessionCookie().parse(cookieHeader)) as string | null;
}

export async function getAuthenticatedSession(request: Request) {
  const db = getOrm();
  const now = new Date().toISOString();
  const sessionId = await getSessionId(request);

  if (!sessionId) {
    return null;
  }

  db.delete(sessions).where(lte(sessions.expiresAt, now)).run();

  const row = db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
    .get();

  if (!row) {
    return null;
  }

  db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, sessionId)).run();
  return mapSession({ ...row, lastSeenAt: now });
}

export async function createAuthenticatedSession(passkeyId: string) {
  const db = getOrm();
  const sessionId = randomBytes(24).toString("hex");
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_TTL_MS);

  db.insert(sessions).values({
    id: sessionId,
    passkeyId,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastSeenAt: createdAt.toISOString(),
  }).run();

  return getSessionCookie().serialize(sessionId);
}

export function destroySessionsForPasskey(passkeyId: string) {
  const db = getOrm();
  db.delete(sessions).where(eq(sessions.passkeyId, passkeyId)).run();
}

export async function destroyAuthenticatedSession(request: Request) {
  const db = getOrm();
  const sessionId = await getSessionId(request);

  if (sessionId) {
    db.delete(sessions).where(eq(sessions.id, sessionId)).run();
  }

  return getSessionCookie().serialize("", { expires: new Date(0), maxAge: undefined });
}
