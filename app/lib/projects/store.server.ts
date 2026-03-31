import { desc, eq } from "drizzle-orm";

import { getOrm } from "~/lib/db.server";
import { projects } from "~/lib/db/schema";
import type { ProjectRecord } from "~/lib/projects/types";

type ProjectRow = typeof projects.$inferSelect;

function mapProject(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    directory: row.directory,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listStoredProjects() {
  const db = getOrm();

  return db.select().from(projects).orderBy(desc(projects.createdAt)).all().map(mapProject);
}

export function getStoredProject(id: string) {
  const db = getOrm();
  const row = db.select().from(projects).where(eq(projects.id, id)).get();

  return row ? mapProject(row) : null;
}

export function createStoredProject(input: {
  id: string;
  name: string;
  directory: string;
}) {
  const db = getOrm();
  const now = new Date().toISOString();

  db.insert(projects).values({
    id: input.id,
    name: input.name,
    directory: input.directory,
    createdAt: now,
    updatedAt: now,
  }).run();

  return getStoredProject(input.id);
}

export function deleteStoredProject(id: string) {
  const db = getOrm();
  db.delete(projects).where(eq(projects.id, id)).run();
}
