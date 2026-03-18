import { and, eq } from "drizzle-orm";

import { getOrm } from "~/lib/db.server";
import { sessionReadStatuses } from "~/lib/db/schema";
import { type SessionReadEvent } from "~/lib/session-read-status";

type SessionReadStatusRow = typeof sessionReadStatuses.$inferSelect;

type SessionReadKey = {
  instanceId: string;
  sessionId: string;
};

type SessionReadStatusRecord = SessionReadKey & {
  lastReadAt: number;
};

type SessionReadSubscriber = (event: SessionReadEvent) => void;

const subscribers = new Set<SessionReadSubscriber>();

function mapSessionReadStatus(row: SessionReadStatusRow): SessionReadStatusRecord | null {
  const lastReadAt = Date.parse(row.lastReadAt);

  if (!Number.isFinite(lastReadAt)) {
    return null;
  }

  return {
    instanceId: row.instanceId,
    sessionId: row.sessionId,
    lastReadAt,
  };
}

function publishSessionReadEvent(event: SessionReadEvent) {
  for (const subscriber of subscribers) {
    subscriber(event);
  }
}

export function listSessionReadStatuses() {
  const db = getOrm();

  return db.select().from(sessionReadStatuses).all()
    .map(mapSessionReadStatus)
    .filter((value): value is SessionReadStatusRecord => value !== null);
}

export function markSessionRead(input: SessionReadKey, now = new Date()) {
  const db = getOrm();
  const current = db.select().from(sessionReadStatuses).where(and(
    eq(sessionReadStatuses.instanceId, input.instanceId),
    eq(sessionReadStatuses.sessionId, input.sessionId),
  )).get();
  const lastReadAt = now.toISOString();

  if (current && Date.parse(current.lastReadAt) >= now.getTime()) {
    return mapSessionReadStatus(current);
  }

  if (current) {
    db.update(sessionReadStatuses)
      .set({
        lastReadAt,
        updatedAt: lastReadAt,
      })
      .where(and(
        eq(sessionReadStatuses.instanceId, input.instanceId),
        eq(sessionReadStatuses.sessionId, input.sessionId),
      ))
      .run();
  } else {
    db.insert(sessionReadStatuses).values({
      instanceId: input.instanceId,
      sessionId: input.sessionId,
      lastReadAt,
      createdAt: lastReadAt,
      updatedAt: lastReadAt,
    }).run();
  }

  const event: SessionReadEvent = {
    type: "session.read",
    instanceId: input.instanceId,
    sessionId: input.sessionId,
    lastReadAt: now.getTime(),
  };

  publishSessionReadEvent(event);

  return {
    instanceId: input.instanceId,
    sessionId: input.sessionId,
    lastReadAt: event.lastReadAt,
  } satisfies SessionReadStatusRecord;
}

export function subscribeToSessionReadEvents(subscriber: SessionReadSubscriber) {
  subscribers.add(subscriber);

  return () => {
    subscribers.delete(subscriber);
  };
}

export type { SessionReadKey, SessionReadStatusRecord };
