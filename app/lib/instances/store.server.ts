import { desc, eq } from "drizzle-orm";

import { getOrm } from "~/lib/db.server";
import { instances } from "~/lib/db/schema";
import type { InstanceRecord, InstanceStatus } from "~/lib/instances/types";

type InstanceRow = typeof instances.$inferSelect;

function mapInstance(row: InstanceRow): InstanceRecord {
  return {
    id: row.id,
    name: row.name,
    directory: row.directory,
    port: row.port,
    status: row.status as InstanceStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastStartedAt: row.lastStartedAt,
    lastExitAt: row.lastExitAt,
    lastError: row.lastError,
  };
}

export function listStoredInstances() {
  const db = getOrm();

  return db.select().from(instances).orderBy(desc(instances.createdAt)).all().map(mapInstance);
}

export function getStoredInstance(id: string) {
  const db = getOrm();
  const row = db.select().from(instances).where(eq(instances.id, id)).get();

  return row ? mapInstance(row) : null;
}

export function createStoredInstance(input: {
  id: string;
  name: string;
  directory: string;
  port: number;
  status: InstanceStatus;
}) {
  const db = getOrm();
  const now = new Date().toISOString();

  db.insert(instances).values({
    id: input.id,
    name: input.name,
    directory: input.directory,
    port: input.port,
    status: input.status,
    createdAt: now,
    updatedAt: now,
    lastStartedAt: input.status === "running" ? now : null,
    lastExitAt: null,
    lastError: null,
  }).run();

  return getStoredInstance(input.id);
}

export function updateStoredInstance(
  id: string,
  updates: Partial<{
    name: string;
    directory: string;
    port: number;
    status: InstanceStatus;
    lastStartedAt: string | null;
    lastExitAt: string | null;
    lastError: string | null;
  }>,
) {
  const db = getOrm();

  db.update(instances)
    .set({
      ...updates,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(instances.id, id))
    .run();

  return getStoredInstance(id);
}

export function deleteStoredInstance(id: string) {
  const db = getOrm();
  db.delete(instances).where(eq(instances.id, id)).run();
}
