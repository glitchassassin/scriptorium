import { and, desc, eq } from "drizzle-orm";

import { getOrm } from "~/lib/db.server";
import { modelUsages } from "~/lib/db/schema";
import { listOpencodeMessages, listOpencodeSessions } from "~/lib/projects/opencode.server";
import { listProjects } from "~/lib/projects/runtime.server";
import type { ProjectRecord } from "~/lib/projects/types";
import type { OpencodeMessageInfo, OpencodeMessageWithParts, OpencodeProvider } from "~/lib/opencode/events";
import {
  getLatestMessageModelChoice,
  getMessageInfoModelChoice,
  getModelKey,
  normalizeModelChoice,
  parseModelRef,
  type SessionModelChoice,
} from "~/lib/opencode/models";

type ModelUsageRow = typeof modelUsages.$inferSelect;

type ModelUsageRecord = SessionModelChoice & {
  projectId: string;
  sessionId: string;
  usedAt: number;
};

type RecordModelUsageInput = {
  projectId: string;
  sessionId: string;
  model: SessionModelChoice["model"];
  usedAt: number;
  variant?: string | null;
};

const warmingProjects = new Map<string, Promise<void>>();
const warmingSessions = new Map<string, Promise<void>>();
const warmedProjects = new Set<string>();
let warmingGlobal: Promise<void> | null = null;
let warmedGlobal = false;

function getSessionKey(projectId: string, sessionId: string) {
  return `${projectId}:${sessionId}`;
}

function mapRow(row: ModelUsageRow): ModelUsageRecord | null {
  const usedAt = Date.parse(row.usedAt);

  if (!Number.isFinite(usedAt)) {
    return null;
  }

  return {
    projectId: row.projectId,
    model: {
      modelID: row.modelId,
      providerID: row.providerId,
    },
    sessionId: row.sessionId,
    usedAt,
    variant: row.variant ?? null,
  } satisfies ModelUsageRecord;
}

function getRows(input?: { projectId?: string; sessionId?: string }) {
  const db = getOrm();

  if (input?.projectId && input.sessionId) {
    return db.select().from(modelUsages)
      .where(and(eq(modelUsages.projectId, input.projectId), eq(modelUsages.sessionId, input.sessionId)))
      .orderBy(desc(modelUsages.usedAt))
      .all();
  }

  if (input?.projectId) {
    return db.select().from(modelUsages)
      .where(eq(modelUsages.projectId, input.projectId))
      .orderBy(desc(modelUsages.usedAt))
      .all();
  }

  return db.select().from(modelUsages).orderBy(desc(modelUsages.usedAt)).all();
}

function getChoices(rows: ModelUsageRow[], providers: OpencodeProvider[], input?: { exclude?: Set<string>; limit?: number }) {
  const seen = new Set(input?.exclude ?? []);
  const items: Array<SessionModelChoice & { usedAt: number }> = [];

  for (const row of rows) {
    const item = mapRow(row);

    if (!item) {
      continue;
    }

    const key = getModelKey(item.model);

    if (seen.has(key)) {
      continue;
    }

    const choice = normalizeModelChoice({ model: item.model, variant: item.variant }, providers);

    if (!choice) {
      continue;
    }

    seen.add(key);
    items.push({
      ...choice,
      usedAt: item.usedAt,
    });

    if (input?.limit && items.length >= input.limit) {
      break;
    }
  }

  return items;
}

function recordMessages(projectId: string, messages: OpencodeMessageWithParts[]) {
  messages.forEach((message) => {
    const choice = getMessageInfoModelChoice(message.info);

    if (!choice) {
      return;
    }

    recordModelUsage({
      projectId,
      model: choice.model,
      sessionId: message.info.sessionID,
      usedAt: choice.usedAt,
      variant: choice.variant,
    });
  });
}

async function warmSession(project: ProjectRecord, sessionId: string) {
  const key = getSessionKey(project.id, sessionId);
  const current = warmingSessions.get(key);

  if (current) {
    await current;
    return;
  }

  const next = (async () => {
    try {
      recordMessages(project.id, await listOpencodeMessages(project, sessionId));
    } catch {
      return;
    } finally {
      warmingSessions.delete(key);
    }
  })();

  warmingSessions.set(key, next);
  await next;
}

async function warmProject(project: ProjectRecord) {
  if (warmedProjects.has(project.id)) {
    return;
  }

  const current = warmingProjects.get(project.id);

  if (current) {
    await current;
    return;
  }

  const next = (async () => {
    try {
      const sessions = await listOpencodeSessions(project);

      for (const session of sessions) {
        recordMessages(project.id, await listOpencodeMessages(project, session.id));
      }

      warmedProjects.add(project.id);
    } catch {
      return;
    } finally {
      warmingProjects.delete(project.id);
    }
  })();

  warmingProjects.set(project.id, next);
  await next;
}

async function warmGlobal() {
  if (warmedGlobal) {
    return;
  }

  if (warmingGlobal) {
    await warmingGlobal;
    return;
  }

  warmingGlobal = (async () => {
    try {
      const projects = await listProjects();

      for (const project of projects) {
        await warmProject(project);
      }

      warmedGlobal = true;
    } catch {
      return;
    } finally {
      warmingGlobal = null;
    }
  })();

  await warmingGlobal;
}

async function getSessionChoice(project: ProjectRecord, sessionId: string, messages: OpencodeMessageWithParts[], providers: OpencodeProvider[]) {
  const choice = getLatestMessageModelChoice(messages, providers);

  if (choice) {
    return choice;
  }

  let items = getChoices(getRows({ projectId: project.id, sessionId }), providers, { limit: 1 });

  if (items.length > 0) {
    return items[0] ?? null;
  }

  await warmSession(project, sessionId);
  items = getChoices(getRows({ projectId: project.id, sessionId }), providers, { limit: 1 });

  return items[0] ?? null;
}

async function getProjectChoices(project: ProjectRecord, providers: OpencodeProvider[], limit: number, exclude?: Set<string>) {
  let items = getChoices(getRows({ projectId: project.id }), providers, { exclude, limit });

  if (items.length >= limit || warmedProjects.has(project.id)) {
    return items;
  }

  await warmProject(project);
  items = getChoices(getRows({ projectId: project.id }), providers, { exclude, limit });

  return items;
}

async function getGlobalChoices(providers: OpencodeProvider[], limit: number, exclude?: Set<string>) {
  let items = getChoices(getRows(), providers, { exclude, limit });

  if (items.length >= limit || warmedGlobal) {
    return items;
  }

  await warmGlobal();
  items = getChoices(getRows(), providers, { exclude, limit });

  return items;
}

export function recordModelUsage(input: RecordModelUsageInput, now = new Date()) {
  if (!Number.isFinite(input.usedAt)) {
    return null;
  }

  const db = getOrm();
  const where = and(
    eq(modelUsages.projectId, input.projectId),
    eq(modelUsages.sessionId, input.sessionId),
    eq(modelUsages.providerId, input.model.providerID),
    eq(modelUsages.modelId, input.model.modelID),
  );
  const current = db.select().from(modelUsages).where(where).get();
  const usedAt = new Date(input.usedAt).toISOString();
  const updatedAt = now.toISOString();

  if (current && Date.parse(current.usedAt) > input.usedAt) {
    return mapRow(current);
  }

  if (current) {
    db.update(modelUsages)
      .set({
        updatedAt,
        usedAt,
        variant: input.variant ?? null,
      })
      .where(where)
      .run();
  } else {
    db.insert(modelUsages).values({
      createdAt: updatedAt,
      projectId: input.projectId,
      modelId: input.model.modelID,
      providerId: input.model.providerID,
      sessionId: input.sessionId,
      updatedAt,
      usedAt,
      variant: input.variant ?? null,
    }).run();
  }

  return {
    projectId: input.projectId,
    model: input.model,
    sessionId: input.sessionId,
    usedAt: input.usedAt,
    variant: input.variant ?? null,
  } satisfies ModelUsageRecord;
}

export function recordOpencodeMessageUsage(projectId: string, info: OpencodeMessageInfo) {
  const choice = getMessageInfoModelChoice(info);

  if (!choice) {
    return null;
  }

  return recordModelUsage({
    projectId,
    model: choice.model,
    sessionId: info.sessionID,
    usedAt: choice.usedAt,
    variant: choice.variant,
  });
}

export function clearSessionModelUsage(projectId: string, sessionId: string) {
  getOrm().delete(modelUsages)
    .where(and(eq(modelUsages.projectId, projectId), eq(modelUsages.sessionId, sessionId)))
    .run();
}

export async function resolveSessionModelChoice(input: {
  configModel?: string | null;
  project: ProjectRecord;
  messages: OpencodeMessageWithParts[];
  providers: OpencodeProvider[];
  sessionId: string;
}) {
  const current = await getSessionChoice(input.project, input.sessionId, input.messages, input.providers);

  if (current) {
    return current;
  }

  const parsedConfigModel = parseModelRef(input.configModel);
  const config = normalizeModelChoice(
    parsedConfigModel ? { model: parsedConfigModel, variant: null } : null,
    input.providers,
  );

  if (config) {
    return config;
  }

  const project = await getProjectChoices(input.project, input.providers, 1);

  if (project.length > 0) {
    return project[0] ?? null;
  }

  const global = await getGlobalChoices(input.providers, 1);
  return global[0] ?? null;
}

export async function listRecentModelChoices(input: {
  project: ProjectRecord;
  limit?: number;
  providers: OpencodeProvider[];
}) {
  const limit = input.limit ?? 3;
  const project = await getProjectChoices(input.project, input.providers, limit);

  if (project.length >= limit) {
    return project;
  }

  const exclude = new Set(project.map((item) => getModelKey(item.model)));
  const global = await getGlobalChoices(input.providers, limit - project.length, exclude);

  return [...project, ...global].slice(0, limit);
}
