import { randomBytes } from "node:crypto";

import { and, eq, gt, lte } from "drizzle-orm";
import { createCookie } from "react-router";

import { getOrm } from "~/lib/db.server";
import { sessions } from "~/lib/db/schema";
import { getRuntimeConfiguration } from "~/lib/runtime-config/cache.server";
import type { SessionRecord } from "~/lib/auth/types";

const SESSION_COOKIE_NAME = "scriptorium_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const SESSION_LAST_SEEN_UPDATE_INTERVAL_MS = 60 * 1000;

let sessionCookie: ReturnType<typeof createCookie> | null = null;
let nextCleanupAt = 0;
const lastSeenWrites = new Map<string, number>();
const sessionCache = new Map<string, SessionRecord>();

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
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const sessionId = await getSessionId(request);

  if (!sessionId) {
    return null;
  }

  if (nextCleanupAt <= nowMs) {
    // Most loaders hit auth, so expired-session cleanup is batched instead of
    // turning every authenticated request into a write-heavy path.
    db.delete(sessions).where(lte(sessions.expiresAt, now)).run();
    nextCleanupAt = nowMs + SESSION_CLEANUP_INTERVAL_MS;
  }

  const cached = sessionCache.get(sessionId);

  if (cached && Date.parse(cached.expiresAt) > nowMs) {
    return cached;
  }

  const row = db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
    .get();

  if (!row) {
    sessionCache.delete(sessionId);
    return null;
  }

  const lastSeenMs = Math.max(Date.parse(row.lastSeenAt) || 0, lastSeenWrites.get(sessionId) ?? 0);

  if (nowMs - lastSeenMs < SESSION_LAST_SEEN_UPDATE_INTERVAL_MS) {
    // Session validity only needs coarse last-seen updates, so frequent reads
    // can reuse the stored value without rewriting the same row each time.
    const session = mapSession(row);
    sessionCache.set(sessionId, session);
    return session;
  }

  db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, sessionId)).run();
  lastSeenWrites.set(sessionId, nowMs);
  const session = mapSession({ ...row, lastSeenAt: now });
  sessionCache.set(sessionId, session);
  return session;
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
  lastSeenWrites.set(sessionId, createdAt.getTime());
  sessionCache.set(sessionId, {
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    id: sessionId,
    lastSeenAt: createdAt.toISOString(),
    passkeyId,
  });

  return getSessionCookie().serialize(sessionId);
}

export function destroySessionsForPasskey(passkeyId: string) {
  const db = getOrm();
  db.delete(sessions).where(eq(sessions.passkeyId, passkeyId)).run();

  for (const [sessionId, session] of sessionCache) {
    if (session.passkeyId === passkeyId) {
      sessionCache.delete(sessionId);
      lastSeenWrites.delete(sessionId);
    }
  }
}

export async function destroyAuthenticatedSession(request: Request) {
  const db = getOrm();
  const sessionId = await getSessionId(request);

  if (sessionId) {
    db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    lastSeenWrites.delete(sessionId);
    sessionCache.delete(sessionId);
  }

  return getSessionCookie().serialize("", { expires: new Date(0), maxAge: undefined });
}
