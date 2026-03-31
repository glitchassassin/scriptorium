import { eq } from "drizzle-orm";

import { getOrm } from "~/lib/db.server";
import { sessionReadStatuses } from "~/lib/db/schema";
import {
  clearSessionModelUsage,
  recordOpencodeMessageUsage,
} from "~/lib/model-usage.server";
import {
  getProject,
  listProjects,
  subscribeToProjectRuntimeEvents,
  type ProjectRuntimeEvent,
} from "~/lib/projects/runtime.server";
import { isRootSession, toSessionSummary } from "~/lib/projects/sidebar";
import { parseOpencodeEvent, type OpencodeEvent } from "~/lib/opencode/events";
import { createProjectScopedHeaders, getSharedOpencodeServerUrl } from "~/lib/opencode/shared-runtime.server";
import {
  type SessionActivityEvent,
  type SessionDeletedEvent,
  type SessionEvent,
  type SessionEventType,
  type SessionReadEvent,
  type SessionSidebarSummary,
  type SessionStatusEvent,
  type SessionSummaryEvent,
} from "~/lib/session-events";

type SessionReadStatusRow = typeof sessionReadStatuses.$inferSelect;

type SessionReadKey = {
  sessionId: string;
};

type SessionReadStatusRecord = SessionReadKey & {
  lastReadAt: number;
};

type SessionEventSubscriber = (event: SessionEvent) => void;

type SessionEventFilter = {
  sessionId?: string;
  types?: readonly SessionEventType[];
};

const subscribers = new Set<SessionEventSubscriber>();

function mapSessionReadStatus(row: SessionReadStatusRow): SessionReadStatusRecord | null {
  const lastReadAt = Date.parse(row.lastReadAt);

  if (!Number.isFinite(lastReadAt)) {
    return null;
  }

  return {
    sessionId: row.sessionId,
    lastReadAt,
  };
}

function getSessionId(event: SessionEvent) {
  switch (event.type) {
    case "session.read":
    case "session.activity":
    case "session.status":
    case "session.deleted":
      return event.sessionId;
    case "session.summary":
      return event.summary.id;
  }
}

function matchesFilter(event: SessionEvent, filter?: SessionEventFilter) {
  if (!filter) {
    return true;
  }

  if (filter.types?.length && !filter.types.includes(event.type)) {
    return false;
  }

  if (filter.sessionId && getSessionId(event) !== filter.sessionId) {
    return false;
  }

  return true;
}

function shouldStartFanIn(filter?: SessionEventFilter) {
  return !filter?.types?.length || filter.types.some((type) => type !== "session.read");
}

function publishSessionEvent(event: SessionEvent) {
  for (const subscriber of subscribers) {
    subscriber(event);
  }
}

function createSessionSummaryEvent(projectId: string, event: Extract<OpencodeEvent, { type: "session.created" | "session.updated" }>) {
  if (!isRootSession(event.properties.info)) {
    return null;
  }

  const summary = toSessionSummary(event.properties.info);

  return {
    type: "session.summary",
    projectId,
    summary: {
      id: summary.id,
      parentID: summary.parentID,
      title: summary.title,
      directory: summary.directory,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
    } satisfies SessionSidebarSummary,
  } satisfies SessionSummaryEvent;
}

function createSessionDeletedEvent(projectId: string, event: Extract<OpencodeEvent, { type: "session.deleted" }>) {
  if (!isRootSession(event.properties.info)) {
    return null;
  }

  return {
    type: "session.deleted",
    projectId,
    sessionId: event.properties.info.id,
  } satisfies SessionDeletedEvent;
}

function createSessionActivityEvent(projectId: string, sessionId: string, updatedAt: number) {
  return {
    type: "session.activity",
    projectId,
    sessionId,
    updatedAt,
  } satisfies SessionActivityEvent;
}

function createSessionStatusEvent(projectId: string, event: Extract<OpencodeEvent, { type: "session.status" }>) {
  return {
    type: "session.status",
    projectId,
    sessionId: event.properties.sessionID,
    status: event.properties.status,
  } satisfies SessionStatusEvent;
}

function getSessionActivityEvent(projectId: string, event: OpencodeEvent) {
  switch (event.type) {
    case "session.created":
    case "session.updated": {
      if (!isRootSession(event.properties.info)) {
        return null;
      }

      return createSessionActivityEvent(
        projectId,
        event.properties.info.id,
        event.properties.info.time.updated ?? event.properties.info.time.created,
      );
    }
    case "message.updated":
      return createSessionActivityEvent(projectId, event.properties.info.sessionID, event.properties.info.time.created);
    case "message.part.updated": {
      const partTime = "time" in event.properties.part ? event.properties.part.time : undefined;

      if (partTime && typeof partTime === "object") {
        const start = "start" in partTime ? partTime.start : null;
        const end = "end" in partTime ? partTime.end : null;
        return createSessionActivityEvent(
          projectId,
          event.properties.part.sessionID,
          typeof end === "number" ? end : typeof start === "number" ? start : Date.now(),
        );
      }

      return createSessionActivityEvent(projectId, event.properties.part.sessionID, Date.now());
    }
    case "message.part.delta":
    case "message.part.removed":
    case "permission.asked":
    case "question.asked":
      return createSessionActivityEvent(projectId, event.properties.sessionID, Date.now());
    case "session.error":
      return event.properties.sessionID
        ? createSessionActivityEvent(projectId, event.properties.sessionID, Date.now())
        : null;
    default:
      return null;
  }
}

function getModelUsageInvalidation(event: OpencodeEvent) {
  if (event.type === "message.removed") {
    return {
      sessionId: event.properties.sessionID,
    };
  }

  if (event.type === "session.updated" && event.properties.info.revert) {
    return {
      sessionId: event.properties.info.id,
    };
  }

  if (event.type === "session.deleted") {
    return {
      sessionId: event.properties.info.id,
    };
  }

  return null;
}

async function consumeEventStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (payload: string) => void,
  signal: AbortSignal,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let dataLines: string[] = [];

  const flush = () => {
    if (!dataLines.length) {
      return;
    }

    onEvent(dataLines.join("\n"));
    dataLines = [];
  };

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const newlineIndex = buffer.indexOf("\n");

        if (newlineIndex === -1) {
          break;
        }

        const rawLine = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

        if (!line) {
          flush();
          continue;
        }

        if (line.startsWith(":")) {
          continue;
        }

        if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
    }

    buffer += decoder.decode();

    if (buffer) {
      const line = buffer.endsWith("\r") ? buffer.slice(0, -1) : buffer;

      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    flush();
  } finally {
    reader.releaseLock();
  }
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}

class SessionEventFanInManager {
  private readonly connections = new Map<string, AbortController>();
  private started = false;
  private unsubscribeRuntime = () => {};

  async ensureStarted() {
    if (this.started) {
      return;
    }

    this.started = true;
    this.unsubscribeRuntime = subscribeToProjectRuntimeEvents((event) => {
      void this.handleRuntimeEvent(event);
    });

    const projects = await listProjects();

    for (const project of projects) {
      this.connectProject(project.id);
    }
  }

  reset() {
    this.started = false;
    this.unsubscribeRuntime();
    this.unsubscribeRuntime = () => {};

    for (const controller of this.connections.values()) {
      controller.abort();
    }

    this.connections.clear();
  }

  private async handleRuntimeEvent(event: ProjectRuntimeEvent) {
    if (event.type === "project.removed") {
      this.disconnectProject(event.projectId);
      return;
    }

    this.connectProject(event.project.id);
  }

  private connectProject(projectId: string) {
    if (this.connections.has(projectId)) {
      return;
    }

    const controller = new AbortController();
    this.connections.set(projectId, controller);
    void this.streamProjectEvents(projectId, controller);
  }

  private disconnectProject(projectId: string) {
    const controller = this.connections.get(projectId);

    if (!controller) {
      return;
    }

    this.connections.delete(projectId);
    controller.abort();
  }

  private async streamProjectEvents(projectId: string, controller: AbortController) {
    while (!controller.signal.aborted) {
      try {
        const project = await getProject(projectId);

        if (!project) {
          this.disconnectProject(projectId);
          return;
        }

        const response = await fetch(`${await getSharedOpencodeServerUrl()}/event`, {
          headers: createProjectScopedHeaders(project.directory, {
            Accept: "text/event-stream",
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Event stream request failed with ${response.status}`);
        }

        await consumeEventStream(
          response.body,
          (payload) => {
            this.handleProjectPayload(projectId, payload);
          },
          controller.signal,
        );
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const latest = await getProject(projectId);

        if (!latest) {
          this.disconnectProject(projectId);
          return;
        }

        await wait(500, controller.signal);
        continue;
      }

      if (controller.signal.aborted) {
        return;
      }

      const latest = await getProject(projectId);

      if (!latest) {
        this.disconnectProject(projectId);
        return;
      }

      await wait(250, controller.signal);
    }
  }

  private handleProjectPayload(projectId: string, payload: string) {
    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(payload) as unknown;
    } catch {
      return;
    }

    const result = parseOpencodeEvent(parsedPayload);

    if (result.kind !== "known") {
      return;
    }

    const summaryEvent =
      result.data.type === "session.created" || result.data.type === "session.updated"
        ? createSessionSummaryEvent(projectId, result.data)
        : null;

    if (result.data.type === "message.updated") {
      recordOpencodeMessageUsage(projectId, result.data.properties.info);
    }

    const invalidation = getModelUsageInvalidation(result.data);

    if (invalidation) {
      clearSessionModelUsage(projectId, invalidation.sessionId);
    }

    if (summaryEvent) {
      publishSessionEvent(summaryEvent);
    }

      const deletedEvent = result.data.type === "session.deleted" ? createSessionDeletedEvent(projectId, result.data) : null;

    if (deletedEvent) {
      publishSessionEvent(deletedEvent);
    }

      const statusEvent = result.data.type === "session.status" ? createSessionStatusEvent(projectId, result.data) : null;

    if (statusEvent) {
      publishSessionEvent(statusEvent);
    }

      const activityEvent = getSessionActivityEvent(projectId, result.data);

    if (activityEvent) {
      publishSessionEvent(activityEvent);
    }
  }
}

const manager = new SessionEventFanInManager();

export function listSessionReadStatuses() {
  const db = getOrm();

  return db.select().from(sessionReadStatuses).all()
    .map(mapSessionReadStatus)
    .filter((value): value is SessionReadStatusRecord => value !== null);
}

export function markSessionRead(input: SessionReadKey, now = new Date()) {
  const db = getOrm();
  const current = db.select().from(sessionReadStatuses).where(eq(sessionReadStatuses.sessionId, input.sessionId)).get();
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
      .where(eq(sessionReadStatuses.sessionId, input.sessionId))
      .run();
  } else {
    db.insert(sessionReadStatuses).values({
      sessionId: input.sessionId,
      lastReadAt,
      createdAt: lastReadAt,
      updatedAt: lastReadAt,
    }).run();
  }

  const event: SessionReadEvent = {
    type: "session.read",
    sessionId: input.sessionId,
    lastReadAt: now.getTime(),
  };

  publishSessionEvent(event);

  return {
    sessionId: input.sessionId,
    lastReadAt: event.lastReadAt,
  } satisfies SessionReadStatusRecord;
}

export async function ensureSessionEventsStarted() {
  await manager.ensureStarted();
}

export function subscribeToSessionEvents(subscriber: SessionEventSubscriber, filter?: SessionEventFilter) {
  const wrapped: SessionEventSubscriber = (event) => {
    if (!matchesFilter(event, filter)) {
      return;
    }

    subscriber(event);
  };

  subscribers.add(wrapped);

  if (shouldStartFanIn(filter)) {
    void manager.ensureStarted().catch(() => {
      if (subscribers.has(wrapped)) {
        subscribers.delete(wrapped);
      }
    });
  }

  return () => {
    subscribers.delete(wrapped);

    if (subscribers.size === 0) {
      manager.reset();
    }
  };
}

export function resetSessionEventsForTests() {
  subscribers.clear();
  manager.reset();
}

export type { SessionEventFilter, SessionReadKey, SessionReadStatusRecord };
