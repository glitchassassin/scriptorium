import { and, desc, eq } from "drizzle-orm";

import { getOrm } from "~/lib/db.server";
import { modelUsages } from "~/lib/db/schema";
import { listOpencodeMessages, listOpencodeSessions } from "~/lib/instances/opencode.server";
import { listInstances } from "~/lib/instances/runtime.server";
import type { InstanceRecord } from "~/lib/instances/types";
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
  instanceId: string;
  sessionId: string;
  usedAt: number;
};

type RecordModelUsageInput = {
  instanceId: string;
  sessionId: string;
  model: SessionModelChoice["model"];
  usedAt: number;
  variant?: string | null;
};

const warmingInstances = new Map<string, Promise<void>>();
const warmingSessions = new Map<string, Promise<void>>();
const warmedInstances = new Set<string>();
let warmingGlobal: Promise<void> | null = null;
let warmedGlobal = false;

function getSessionKey(instanceId: string, sessionId: string) {
  return `${instanceId}:${sessionId}`;
}

function mapRow(row: ModelUsageRow): ModelUsageRecord | null {
  const usedAt = Date.parse(row.usedAt);

  if (!Number.isFinite(usedAt)) {
    return null;
  }

  return {
    instanceId: row.instanceId,
    model: {
      modelID: row.modelId,
      providerID: row.providerId,
    },
    sessionId: row.sessionId,
    usedAt,
    variant: row.variant ?? null,
  } satisfies ModelUsageRecord;
}

function getRows(input?: { instanceId?: string; sessionId?: string }) {
  const db = getOrm();

  if (input?.instanceId && input.sessionId) {
    return db.select().from(modelUsages)
      .where(and(eq(modelUsages.instanceId, input.instanceId), eq(modelUsages.sessionId, input.sessionId)))
      .orderBy(desc(modelUsages.usedAt))
      .all();
  }

  if (input?.instanceId) {
    return db.select().from(modelUsages)
      .where(eq(modelUsages.instanceId, input.instanceId))
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

function recordMessages(instanceId: string, messages: OpencodeMessageWithParts[]) {
  messages.forEach((message) => {
    const choice = getMessageInfoModelChoice(message.info);

    if (!choice) {
      return;
    }

    recordModelUsage({
      instanceId,
      model: choice.model,
      sessionId: message.info.sessionID,
      usedAt: choice.usedAt,
      variant: choice.variant,
    });
  });
}

async function warmSession(instance: InstanceRecord, sessionId: string) {
  const key = getSessionKey(instance.id, sessionId);
  const current = warmingSessions.get(key);

  if (current) {
    await current;
    return;
  }

  const next = (async () => {
    try {
      recordMessages(instance.id, await listOpencodeMessages(instance, sessionId));
    } catch {
      return;
    } finally {
      warmingSessions.delete(key);
    }
  })();

  warmingSessions.set(key, next);
  await next;
}

async function warmInstance(instance: InstanceRecord) {
  if (warmedInstances.has(instance.id)) {
    return;
  }

  const current = warmingInstances.get(instance.id);

  if (current) {
    await current;
    return;
  }

  const next = (async () => {
    try {
      const sessions = await listOpencodeSessions(instance);

      for (const session of sessions) {
        recordMessages(instance.id, await listOpencodeMessages(instance, session.id));
      }

      warmedInstances.add(instance.id);
    } catch {
      return;
    } finally {
      warmingInstances.delete(instance.id);
    }
  })();

  warmingInstances.set(instance.id, next);
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
      const instances = await listInstances();

      for (const instance of instances) {
        await warmInstance(instance);
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

async function getSessionChoice(instance: InstanceRecord, sessionId: string, messages: OpencodeMessageWithParts[], providers: OpencodeProvider[]) {
  const choice = getLatestMessageModelChoice(messages, providers);

  if (choice) {
    return choice;
  }

  let items = getChoices(getRows({ instanceId: instance.id, sessionId }), providers, { limit: 1 });

  if (items.length > 0) {
    return items[0] ?? null;
  }

  await warmSession(instance, sessionId);
  items = getChoices(getRows({ instanceId: instance.id, sessionId }), providers, { limit: 1 });

  return items[0] ?? null;
}

async function getInstanceChoices(instance: InstanceRecord, providers: OpencodeProvider[], limit: number, exclude?: Set<string>) {
  let items = getChoices(getRows({ instanceId: instance.id }), providers, { exclude, limit });

  if (items.length >= limit || warmedInstances.has(instance.id)) {
    return items;
  }

  await warmInstance(instance);
  items = getChoices(getRows({ instanceId: instance.id }), providers, { exclude, limit });

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
    eq(modelUsages.instanceId, input.instanceId),
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
      instanceId: input.instanceId,
      modelId: input.model.modelID,
      providerId: input.model.providerID,
      sessionId: input.sessionId,
      updatedAt,
      usedAt,
      variant: input.variant ?? null,
    }).run();
  }

  return {
    instanceId: input.instanceId,
    model: input.model,
    sessionId: input.sessionId,
    usedAt: input.usedAt,
    variant: input.variant ?? null,
  } satisfies ModelUsageRecord;
}

export function recordOpencodeMessageUsage(instanceId: string, info: OpencodeMessageInfo) {
  const choice = getMessageInfoModelChoice(info);

  if (!choice) {
    return null;
  }

  return recordModelUsage({
    instanceId,
    model: choice.model,
    sessionId: info.sessionID,
    usedAt: choice.usedAt,
    variant: choice.variant,
  });
}

export function clearSessionModelUsage(instanceId: string, sessionId: string) {
  getOrm().delete(modelUsages)
    .where(and(eq(modelUsages.instanceId, instanceId), eq(modelUsages.sessionId, sessionId)))
    .run();
}

export async function resolveSessionModelChoice(input: {
  configModel?: string | null;
  instance: InstanceRecord;
  messages: OpencodeMessageWithParts[];
  providers: OpencodeProvider[];
  sessionId: string;
}) {
  const current = await getSessionChoice(input.instance, input.sessionId, input.messages, input.providers);

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

  const instance = await getInstanceChoices(input.instance, input.providers, 1);

  if (instance.length > 0) {
    return instance[0] ?? null;
  }

  const global = await getGlobalChoices(input.providers, 1);
  return global[0] ?? null;
}

export async function listRecentModelChoices(input: {
  instance: InstanceRecord;
  limit?: number;
  providers: OpencodeProvider[];
}) {
  const limit = input.limit ?? 3;
  const instance = await getInstanceChoices(input.instance, input.providers, limit);

  if (instance.length >= limit) {
    return instance;
  }

  const exclude = new Set(instance.map((item) => getModelKey(item.model)));
  const global = await getGlobalChoices(input.providers, limit - instance.length, exclude);

  return [...instance, ...global].slice(0, limit);
}
