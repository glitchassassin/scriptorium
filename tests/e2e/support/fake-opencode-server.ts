import { fileURLToPath } from "node:url";

import express from "express";

import {
  opencodeCommandInputSchema,
  opencodePromptInputSchema,
  type OpencodeAgent,
  type OpencodeCommandInfo,
  type OpencodeConfig,
  type OpencodeEvent,
  type OpencodeFileDiff,
  type OpencodeMessagePart,
  type OpencodeMessageWithParts,
  type OpencodePermissionRequest,
  type OpencodeProvider,
  type OpencodeQuestionAnswer,
  type OpencodeQuestionRequest,
  type OpencodeSessionInfo,
  type OpencodeSessionStatus,
} from "../../../app/lib/opencode/events.ts";

type SeedSession = {
  diff?: OpencodeFileDiff[];
  info: OpencodeSessionInfo;
  messages?: OpencodeMessageWithParts[];
};

type DirectorySeed = {
  agents?: OpencodeAgent[];
  commands?: OpencodeCommandInfo[];
  config?: OpencodeConfig;
  permissions?: OpencodePermissionRequest[];
  providerDefaults?: Record<string, string>;
  providers?: OpencodeProvider[];
  questions?: OpencodeQuestionRequest[];
  sessions?: SeedSession[];
  statuses?: Record<string, OpencodeSessionStatus>;
};

type DirectorySnapshot = Required<DirectorySeed>;

type SessionState = {
  diff: OpencodeFileDiff[];
  info: OpencodeSessionInfo;
  messages: OpencodeMessageWithParts[];
};

type DirectoryState = {
  agents: OpencodeAgent[];
  commands: OpencodeCommandInfo[];
  config: OpencodeConfig;
  eventClients: Set<import("node:http").ServerResponse>;
  nextIds: {
    message: number;
    part: number;
    permission: number;
    question: number;
    session: number;
  };
  now: number;
  permissions: Map<string, OpencodePermissionRequest>;
  providerDefaults: Record<string, string>;
  providers: OpencodeProvider[];
  questions: Map<string, OpencodeQuestionRequest>;
  sessions: Map<string, SessionState>;
  sessionOrder: string[];
  statuses: Map<string, OpencodeSessionStatus>;
  timers: Set<ReturnType<typeof setTimeout>>;
};

const DEFAULT_PROVIDERS = [
  {
    id: "openai",
    models: {
      "gpt-5": {
        id: "gpt-5",
        name: "GPT 5",
        variants: {
          high: {},
          low: {},
        },
      },
    },
    name: "OpenAI",
  },
] satisfies OpencodeProvider[];

const DEFAULT_COMMANDS = [
  { description: "Create a permission request", name: "permission" },
  { description: "Create a question request", name: "question" },
  { description: "Emit a session error", name: "error" },
  { description: "Reply with a command summary", name: "review" },
] satisfies OpencodeCommandInfo[];

const DEFAULT_AGENTS = [
  { description: "Default coding agent", mode: "primary", name: "build" },
  { description: "Analysis agent", mode: "primary", name: "analysis" },
] satisfies OpencodeAgent[];

const directoryStates = new Map<string, DirectoryState>();

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function createDirectoryState(): DirectoryState {
  return {
    agents: cloneValue(DEFAULT_AGENTS),
    commands: cloneValue(DEFAULT_COMMANDS),
    config: { model: "openai/gpt-5" },
    eventClients: new Set(),
    nextIds: {
      message: 1,
      part: 1,
      permission: 1,
      question: 1,
      session: 1,
    },
    now: 1_700_000_000_000,
    permissions: new Map(),
    providerDefaults: { openai: "gpt-5" },
    providers: cloneValue(DEFAULT_PROVIDERS),
    questions: new Map(),
    sessions: new Map(),
    sessionOrder: [],
    statuses: new Map(),
    timers: new Set(),
  };
}

function ensureDirectoryState(directory: string) {
  const existing = directoryStates.get(directory);

  if (existing) {
    return existing;
  }

  const state = createDirectoryState();
  directoryStates.set(directory, state);
  return state;
}

function closeDirectoryState(directory: string) {
  const state = directoryStates.get(directory);

  if (!state) {
    return;
  }

  for (const timer of state.timers) {
    clearTimeout(timer);
  }

  state.timers.clear();

  for (const client of state.eventClients) {
    client.end();
  }

  state.eventClients.clear();
  directoryStates.delete(directory);
}

function resetAllStates() {
  for (const directory of directoryStates.keys()) {
    closeDirectoryState(directory);
  }
}

function getDirectoryFromHeader(request: express.Request) {
  const encoded = request.get("x-opencode-directory");

  if (!encoded) {
    throw new Error("Missing x-opencode-directory header.");
  }

  return decodeURIComponent(encoded);
}

function nextTimestamp(state: DirectoryState) {
  state.now += 1;
  return state.now;
}

function updateCounter(state: DirectoryState, kind: keyof DirectoryState["nextIds"], id: string) {
  const match = id.match(/-(\d+)$/);

  if (!match) {
    return;
  }

  const parsed = Number(match[1]);

  if (!Number.isFinite(parsed)) {
    return;
  }

  state.nextIds[kind] = Math.max(state.nextIds[kind], parsed + 1);
}

function makeId(state: DirectoryState, kind: keyof DirectoryState["nextIds"]) {
  const value = state.nextIds[kind];
  state.nextIds[kind] += 1;
  return `${kind}-${value}`;
}

function getSessionOrThrow(state: DirectoryState, sessionId: string) {
  const session = state.sessions.get(sessionId);

  if (!session) {
    throw new Error(`Session ${sessionId} not found.`);
  }

  return session;
}

function setSession(state: DirectoryState, session: SessionState) {
  state.sessions.set(session.info.id, session);

  if (!state.sessionOrder.includes(session.info.id)) {
    state.sessionOrder.push(session.info.id);
  }

  updateCounter(state, "session", session.info.id);

  for (const message of session.messages) {
    updateCounter(state, "message", message.info.id);

    for (const part of message.parts) {
      updateCounter(state, "part", part.id);
    }
  }
}

function touchSession(session: SessionState, updatedAt: number) {
  session.info = {
    ...session.info,
    time: {
      ...session.info.time,
      updated: updatedAt,
    },
  };
}

function sendEventPayload(response: import("node:http").ServerResponse, event: OpencodeEvent) {
  response.write(`data: ${JSON.stringify(event)}\n\n`);
}

function emitEvent(directory: string, event: OpencodeEvent) {
  const state = ensureDirectoryState(directory);

  for (const client of state.eventClients) {
    sendEventPayload(client, event);
  }
}

function emitSessionUpdated(directory: string, session: SessionState) {
  emitEvent(directory, {
    properties: {
      info: cloneValue(session.info),
    },
    type: "session.updated",
  });
}

function setStatus(directory: string, sessionId: string, status: OpencodeSessionStatus) {
  const state = ensureDirectoryState(directory);
  state.statuses.set(sessionId, cloneValue(status));
  emitEvent(directory, {
    properties: {
      sessionID: sessionId,
      status: cloneValue(status),
    },
    type: "session.status",
  });
}

function upsertMessage(session: SessionState, message: OpencodeMessageWithParts) {
  const index = session.messages.findIndex((entry) => entry.info.id === message.info.id);

  if (index >= 0) {
    session.messages[index] = message;
    return;
  }

  session.messages.push(message);
}

function emitMessage(directory: string, message: OpencodeMessageWithParts) {
  emitEvent(directory, {
    properties: {
      info: cloneValue(message.info),
    },
    type: "message.updated",
  });

  for (const part of message.parts) {
    emitEvent(directory, {
      properties: {
        part: cloneValue(part),
      },
      type: "message.part.updated",
    });
  }
}

function getPromptText(parts: Array<{ type: "file" | "text"; filename?: string; mime?: string; text?: string }>) {
  const textParts: string[] = [];

  for (const part of parts) {
    if (part.type !== "text") {
      continue;
    }

    textParts.push(part.text ?? "");
  }

  return textParts.join("\n").trim();
}

function createTextPart(state: DirectoryState, sessionId: string, messageId: string, text: string): OpencodeMessagePart {
  return {
    id: makeId(state, "part"),
    messageID: messageId,
    sessionID: sessionId,
    text,
    type: "text",
  };
}

function createFilePart(
  state: DirectoryState,
  sessionId: string,
  messageId: string,
  file: { filename?: string; mime: string; url: string },
): OpencodeMessagePart {
  return {
    filename: file.filename,
    id: makeId(state, "part"),
    messageID: messageId,
    mime: file.mime,
    sessionID: sessionId,
    type: "file",
    url: file.url,
  };
}

function createUserMessage(
  state: DirectoryState,
  sessionId: string,
  input: {
    agent?: string;
    model?: { modelID: string; providerID: string };
    parts: Array<{ type: "file" | "text"; filename?: string; mime?: string; text?: string; url?: string }>;
    variant?: string;
  },
) {
  const createdAt = nextTimestamp(state);
  const messageId = makeId(state, "message");

  return {
    info: {
      ...(input.agent ? { agent: input.agent } : {}),
      ...(input.model ? { model: input.model } : {}),
      ...(input.variant ? { variant: input.variant } : {}),
      id: messageId,
      role: "user",
      sessionID: sessionId,
      time: { created: createdAt },
    },
    parts: input.parts.flatMap((part) => {
      if (part.type === "text") {
        return [createTextPart(state, sessionId, messageId, part.text ?? "")];
      }

      if (!part.mime || !part.url) {
        return [];
      }

      return [createFilePart(state, sessionId, messageId, { filename: part.filename, mime: part.mime, url: part.url })];
    }),
  } satisfies OpencodeMessageWithParts;
}

function createAssistantMessage(
  state: DirectoryState,
  sessionId: string,
  parentId: string,
  text: string,
  overrides?: { providerID?: string; modelID?: string; variant?: string },
) {
  const createdAt = nextTimestamp(state);
  const messageId = makeId(state, "message");

  return {
    info: {
      ...(overrides?.modelID ? { modelID: overrides.modelID } : {}),
      ...(overrides?.providerID ? { providerID: overrides.providerID } : {}),
      ...(overrides?.variant ? { variant: overrides.variant } : {}),
      id: messageId,
      parentID: parentId,
      role: "assistant",
      sessionID: sessionId,
      time: {
        completed: createdAt,
        created: createdAt,
      },
    },
    parts: [createTextPart(state, sessionId, messageId, text)],
  } satisfies OpencodeMessageWithParts;
}

function createSessionInfo(state: DirectoryState, directory: string, input?: { id?: string; parentID?: string; title?: string }) {
  const createdAt = nextTimestamp(state);
  const id = input?.id ?? makeId(state, "session");

  return {
    directory,
    ...(input?.parentID ? { parentID: input.parentID } : {}),
    ...(input?.title ? { title: input.title } : {}),
    id,
    time: {
      created: createdAt,
      updated: createdAt,
    },
  } satisfies OpencodeSessionInfo;
}

function createPermissionRequest(
  state: DirectoryState,
  sessionId: string,
  input?: Partial<OpencodePermissionRequest>,
) {
  const permissionId = input?.id ?? makeId(state, "permission");
  const permission = {
    always: [],
    id: permissionId,
    metadata: {
      description: "Read the current working tree.",
    },
    patterns: ["**/*"],
    permission: "read",
    sessionID: sessionId,
    ...cloneValue(input ?? {}),
  } satisfies OpencodePermissionRequest;

  updateCounter(state, "permission", permission.id);
  return permission;
}

function createQuestionRequest(
  state: DirectoryState,
  sessionId: string,
  input?: Partial<OpencodeQuestionRequest>,
) {
  const questionId = input?.id ?? makeId(state, "question");
  const question = {
    id: questionId,
    questions: [
      {
        header: "Priority",
        options: [
          { description: "Fix this now", label: "High" },
          { description: "Schedule it", label: "Low" },
        ],
        question: "How urgent is this?",
      },
    ],
    sessionID: sessionId,
    ...cloneValue(input ?? {}),
  } satisfies OpencodeQuestionRequest;

  updateCounter(state, "question", question.id);
  return question;
}

function serializeState(state: DirectoryState): DirectorySnapshot {
  return {
    agents: cloneValue(state.agents),
    commands: cloneValue(state.commands),
    config: cloneValue(state.config),
    permissions: cloneValue([...state.permissions.values()]),
    providerDefaults: cloneValue(state.providerDefaults),
    providers: cloneValue(state.providers),
    questions: cloneValue([...state.questions.values()]),
    sessions: state.sessionOrder
      .map((id) => state.sessions.get(id))
      .filter((value): value is SessionState => value !== undefined)
      .map((session) => ({
        diff: cloneValue(session.diff),
        info: cloneValue(session.info),
        messages: cloneValue(session.messages),
      })),
    statuses: Object.fromEntries([...state.statuses.entries()].map(([key, value]) => [key, cloneValue(value)])),
  };
}

function applySeed(directory: string, seed: DirectorySeed = {}) {
  closeDirectoryState(directory);
  const state = ensureDirectoryState(directory);

  state.agents = cloneValue(seed.agents ?? DEFAULT_AGENTS);
  state.commands = cloneValue(seed.commands ?? DEFAULT_COMMANDS);
  state.config = cloneValue(seed.config ?? { model: "openai/gpt-5" });
  state.providerDefaults = cloneValue(seed.providerDefaults ?? { openai: "gpt-5" });
  state.providers = cloneValue(seed.providers ?? DEFAULT_PROVIDERS);

  for (const seededSession of seed.sessions ?? []) {
    setSession(state, {
      diff: cloneValue(seededSession.diff ?? []),
      info: cloneValue(seededSession.info),
      messages: cloneValue(seededSession.messages ?? []),
    });
  }

  for (const [sessionId, status] of Object.entries(seed.statuses ?? {})) {
    state.statuses.set(sessionId, cloneValue(status));
  }

  for (const permission of seed.permissions ?? []) {
    state.permissions.set(permission.id, cloneValue(permission));
    updateCounter(state, "permission", permission.id);
  }

  for (const question of seed.questions ?? []) {
    state.questions.set(question.id, cloneValue(question));
    updateCounter(state, "question", question.id);
  }

  for (const sessionId of state.sessionOrder) {
    if (!state.statuses.has(sessionId)) {
      state.statuses.set(sessionId, { type: "idle" });
    }
  }

  return state;
}

function buildAssistantReply(inputText: string) {
  if (!inputText) {
    return "Ready.";
  }

  return `Echo: ${inputText}`;
}

function scheduleAssistantReply(
  directory: string,
  session: SessionState,
  userMessage: OpencodeMessageWithParts,
  inputText: string,
  model?: { modelID: string; providerID: string },
  variant?: string,
) {
  const state = ensureDirectoryState(directory);
  const timer = setTimeout(() => {
    state.timers.delete(timer);

    const assistantMessage = createAssistantMessage(
      state,
      session.info.id,
      userMessage.info.id,
      buildAssistantReply(inputText),
      {
        modelID: model?.modelID ?? state.providerDefaults.openai,
        providerID: model?.providerID ?? "openai",
        variant,
      },
    );

    upsertMessage(session, assistantMessage);
    touchSession(session, assistantMessage.info.time.completed ?? assistantMessage.info.time.created);
    emitSessionUpdated(directory, session);
    emitMessage(directory, assistantMessage);
    setStatus(directory, session.info.id, { type: "idle" });
  }, 75);

  state.timers.add(timer);
}

function listMessagesPage(messages: OpencodeMessageWithParts[], input?: { before?: string; limit?: number }) {
  if (!messages.length) {
    return { items: [], nextCursor: null };
  }

  const limit = input?.limit ?? messages.length;

  if (limit >= messages.length && !input?.before) {
    return {
      items: cloneValue(messages),
      nextCursor: null,
    };
  }

  const endIndex = input?.before
    ? messages.findIndex((message) => message.info.id === input.before)
    : messages.length;
  const boundedEndIndex = endIndex >= 0 ? endIndex : messages.length;
  const startIndex = Math.max(0, boundedEndIndex - limit);
  const items = messages.slice(startIndex, boundedEndIndex);
  const nextCursor = startIndex > 0 ? items[0]?.info.id ?? null : null;

  return {
    items: cloneValue(items),
    nextCursor,
  };
}

export function startFakeOpencodeServer(port: number) {
  const app = express();

  app.use(express.json({ limit: "5mb" }));

  app.post("/__admin/reset", (request, response) => {
    const directory = typeof request.body?.directory === "string" ? request.body.directory : null;

    if (directory) {
      closeDirectoryState(directory);
    } else {
      resetAllStates();
    }

    response.json({ ok: true });
  });

  app.post("/__admin/seed", (request, response) => {
    const directory = typeof request.body?.directory === "string" ? request.body.directory : null;

    if (!directory) {
      response.status(400).json({ error: "directory is required" });
      return;
    }

    const state = applySeed(directory, request.body?.state as DirectorySeed | undefined);
    response.json(serializeState(state));
  });

  app.get("/__admin/state", (request, response) => {
    const directory = typeof request.query.directory === "string" ? request.query.directory : null;

    if (!directory) {
      response.status(400).json({ error: "directory is required" });
      return;
    }

    response.json(serializeState(ensureDirectoryState(directory)));
  });

  app.post("/__admin/event", (request, response) => {
    const directory = typeof request.body?.directory === "string" ? request.body.directory : null;

    if (!directory || !request.body?.event) {
      response.status(400).json({ error: "directory and event are required" });
      return;
    }

    emitEvent(directory, request.body.event as OpencodeEvent);
    response.json({ ok: true });
  });

  app.get("/event", (request, response) => {
    const directory = getDirectoryFromHeader(request);
    const state = ensureDirectoryState(directory);

    response.writeHead(200, {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    });
    state.eventClients.add(response);
    sendEventPayload(response, {
      properties: {},
      type: "server.connected",
    });

    const heartbeat = setInterval(() => {
      sendEventPayload(response, {
        properties: {},
        type: "server.heartbeat",
      });
    }, 15_000);

    request.on("close", () => {
      clearInterval(heartbeat);
      state.eventClients.delete(response);
      response.end();
    });
  });

  app.get("/session", (request, response) => {
    const directory = getDirectoryFromHeader(request);
    const state = ensureDirectoryState(directory);
    const sessions = state.sessionOrder
      .map((id) => state.sessions.get(id)?.info)
      .filter((value): value is OpencodeSessionInfo => value !== undefined);

    response.json(cloneValue(sessions));
  });

  app.post("/session", (request, response) => {
    const directory = getDirectoryFromHeader(request);
    const state = ensureDirectoryState(directory);
    const session: SessionState = {
      diff: [],
      info: createSessionInfo(state, directory, {
        title: typeof request.body?.title === "string" && request.body.title.trim() ? request.body.title.trim() : undefined,
      }),
      messages: [],
    };

    setSession(state, session);
    state.statuses.set(session.info.id, { type: "idle" });
    emitEvent(directory, {
      properties: {
        info: cloneValue(session.info),
      },
      type: "session.created",
    });
    response.json(cloneValue(session.info));
  });

  app.get("/session/status", (request, response) => {
    const directory = getDirectoryFromHeader(request);
    const state = ensureDirectoryState(directory);
    response.json(Object.fromEntries([...state.statuses.entries()].map(([key, value]) => [key, cloneValue(value)])));
  });

  app.get("/session/:sessionId", (request, response) => {
    const directory = getDirectoryFromHeader(request);
    const session = getSessionOrThrow(ensureDirectoryState(directory), request.params.sessionId);
    response.json(cloneValue(session.info));
  });

  app.get("/session/:sessionId/message", (request, response) => {
    const directory = getDirectoryFromHeader(request);
    const session = getSessionOrThrow(ensureDirectoryState(directory), request.params.sessionId);
    const before = typeof request.query.before === "string" ? request.query.before : undefined;
    const limit = typeof request.query.limit === "string" ? Number(request.query.limit) : undefined;
    const page = listMessagesPage(session.messages, {
      before,
      limit: Number.isFinite(limit) ? limit : undefined,
    });

    if (page.nextCursor) {
      response.setHeader("x-next-cursor", page.nextCursor);
    }

    response.json(page.items);
  });

  app.get("/session/:sessionId/diff", (request, response) => {
    const directory = getDirectoryFromHeader(request);
    const session = getSessionOrThrow(ensureDirectoryState(directory), request.params.sessionId);
    response.json(cloneValue(session.diff));
  });

  app.post("/session/:sessionId/prompt_async", (request, response) => {
    const directory = getDirectoryFromHeader(request);
    const state = ensureDirectoryState(directory);
    const session = getSessionOrThrow(state, request.params.sessionId);
    const parsed = opencodePromptInputSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(400).json({ error: parsed.error.message });
      return;
    }

    const userMessage = createUserMessage(state, session.info.id, parsed.data);
    upsertMessage(session, userMessage);

    const promptText = getPromptText(parsed.data.parts);

    if (!session.info.title && promptText) {
      session.info = {
        ...session.info,
        title: promptText.slice(0, 80),
      };
    }

    touchSession(session, userMessage.info.time.created);
    emitSessionUpdated(directory, session);
    emitMessage(directory, userMessage);
    setStatus(directory, session.info.id, { type: "busy" });
    scheduleAssistantReply(directory, session, userMessage, promptText, parsed.data.model, parsed.data.variant);
    response.status(204).end();
  });

  app.post("/session/:sessionId/command", (request, response) => {
    const directory = getDirectoryFromHeader(request);
    const state = ensureDirectoryState(directory);
    const session = getSessionOrThrow(state, request.params.sessionId);
    const parsed = opencodeCommandInputSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(400).json({ error: parsed.error.message });
      return;
    }

    const now = nextTimestamp(state);
    touchSession(session, now);
    emitSessionUpdated(directory, session);

    if (parsed.data.command === "permission") {
      const permission = createPermissionRequest(state, session.info.id, {
        metadata: {
          description: parsed.data.arguments || "Read the current working tree.",
        },
      });
      state.permissions.set(permission.id, permission);
      emitEvent(directory, { properties: cloneValue(permission), type: "permission.asked" });
      response.json({ ok: true });
      return;
    }

    if (parsed.data.command === "question") {
      const question = createQuestionRequest(state, session.info.id, {
        questions: [
          {
            custom: true,
            header: "Decision",
            multiple: false,
            options: [
              { description: "Run tests first", label: "Tests" },
              { description: "Ship the change", label: "Ship it" },
            ],
            question: parsed.data.arguments || "What should happen next?",
          },
        ],
      });
      state.questions.set(question.id, question);
      emitEvent(directory, { properties: cloneValue(question), type: "question.asked" });
      response.json({ ok: true });
      return;
    }

    if (parsed.data.command === "error") {
      emitEvent(directory, {
        properties: {
          error: { message: parsed.data.arguments || "Fake command error", name: "Error" },
          sessionID: session.info.id,
        },
        type: "session.error",
      });
      response.json({ ok: true });
      return;
    }

    const assistantMessage = createAssistantMessage(
      state,
      session.info.id,
      session.messages[session.messages.length - 1]?.info.id ?? makeId(state, "message"),
      `Command ${parsed.data.command}: ${parsed.data.arguments || "ok"}`,
      {
        modelID: state.providerDefaults.openai,
        providerID: "openai",
        variant: parsed.data.variant,
      },
    );
    upsertMessage(session, assistantMessage);
    touchSession(session, assistantMessage.info.time.completed ?? assistantMessage.info.time.created);
    emitSessionUpdated(directory, session);
    emitMessage(directory, assistantMessage);
    response.json({ ok: true });
  });

  app.post("/session/:sessionId/abort", (request, response) => {
    const directory = getDirectoryFromHeader(request);
    setStatus(directory, request.params.sessionId, { type: "idle" });
    response.json({ ok: true });
  });

  app.post("/session/:sessionId/revert", (request, response) => {
    const directory = getDirectoryFromHeader(request);
    const state = ensureDirectoryState(directory);
    const session = getSessionOrThrow(state, request.params.sessionId);
    const messageId = typeof request.body?.messageID === "string" ? request.body.messageID : "";

    session.info = {
      ...session.info,
      revert: messageId ? { messageID: messageId } : undefined,
    };
    touchSession(session, nextTimestamp(state));
    emitSessionUpdated(directory, session);
    response.json(cloneValue(session.info));
  });

  app.post("/session/:sessionId/unrevert", (request, response) => {
    const directory = getDirectoryFromHeader(request);
    const state = ensureDirectoryState(directory);
    const session = getSessionOrThrow(state, request.params.sessionId);

    session.info = {
      ...session.info,
      revert: undefined,
    };
    touchSession(session, nextTimestamp(state));
    emitSessionUpdated(directory, session);
    response.json(cloneValue(session.info));
  });

  app.post("/session/:sessionId/fork", (request, response) => {
    const directory = getDirectoryFromHeader(request);
    const state = ensureDirectoryState(directory);
    const source = getSessionOrThrow(state, request.params.sessionId);
    const messageId = typeof request.body?.messageID === "string" ? request.body.messageID : null;
    const boundaryIndex = messageId
      ? source.messages.findIndex((message) => message.info.id === messageId)
      : source.messages.length - 1;
    const copiedMessages = boundaryIndex >= 0
      ? source.messages.slice(0, boundaryIndex + 1)
      : source.messages;
    const fork: SessionState = {
      diff: cloneValue(source.diff),
      info: createSessionInfo(state, directory, {
        parentID: source.info.id,
        title: source.info.title,
      }),
      messages: cloneValue(copiedMessages),
    };

    setSession(state, fork);
    state.statuses.set(fork.info.id, { type: "idle" });
    emitEvent(directory, {
      properties: {
        info: cloneValue(fork.info),
      },
      type: "session.created",
    });
    response.json(cloneValue(fork.info));
  });

  app.get("/permission", (request, response) => {
    const directory = getDirectoryFromHeader(request);
    const state = ensureDirectoryState(directory);
    response.json(cloneValue([...state.permissions.values()]));
  });

  app.post("/permission/:requestId/reply", (request, response) => {
    const directory = getDirectoryFromHeader(request);
    const state = ensureDirectoryState(directory);
    const permission = state.permissions.get(request.params.requestId);

    if (!permission) {
      response.status(404).json({ error: "Permission not found" });
      return;
    }

    state.permissions.delete(permission.id);
    emitEvent(directory, {
      properties: {
        requestID: permission.id,
        sessionID: permission.sessionID,
      },
      type: "permission.replied",
    });
    response.json({ ok: true });
  });

  app.get("/question", (request, response) => {
    const directory = getDirectoryFromHeader(request);
    const state = ensureDirectoryState(directory);
    response.json(cloneValue([...state.questions.values()]));
  });

  app.post("/question/:requestId/reply", (request, response) => {
    const directory = getDirectoryFromHeader(request);
    const state = ensureDirectoryState(directory);
    const question = state.questions.get(request.params.requestId);
    const answers = Array.isArray(request.body?.answers) ? request.body.answers as OpencodeQuestionAnswer[] : [];

    if (!question) {
      response.status(404).json({ error: "Question not found" });
      return;
    }

    state.questions.delete(question.id);
    emitEvent(directory, {
      properties: {
        answers: cloneValue(answers),
        requestID: question.id,
        sessionID: question.sessionID,
      },
      type: "question.replied",
    });
    response.json({ ok: true });
  });

  app.post("/question/:requestId/reject", (request, response) => {
    const directory = getDirectoryFromHeader(request);
    const state = ensureDirectoryState(directory);
    const question = state.questions.get(request.params.requestId);

    if (!question) {
      response.status(404).json({ error: "Question not found" });
      return;
    }

    state.questions.delete(question.id);
    emitEvent(directory, {
      properties: {
        requestID: question.id,
        sessionID: question.sessionID,
      },
      type: "question.rejected",
    });
    response.json({ ok: true });
  });

  app.get("/agent", (request, response) => {
    const directory = getDirectoryFromHeader(request);
    response.json(cloneValue(ensureDirectoryState(directory).agents));
  });

  app.get("/command", (request, response) => {
    const directory = getDirectoryFromHeader(request);
    response.json(cloneValue(ensureDirectoryState(directory).commands));
  });

  app.get("/config", (request, response) => {
    const directory = getDirectoryFromHeader(request);
    response.json(cloneValue(ensureDirectoryState(directory).config));
  });

  app.get("/config/providers", (request, response) => {
    const directory = getDirectoryFromHeader(request);
    const state = ensureDirectoryState(directory);
    response.json({
      default: cloneValue(state.providerDefaults),
      providers: cloneValue(state.providers),
    });
  });

  const server = app.listen(port, "127.0.0.1");

  return {
    close: () => new Promise<void>((resolve, reject) => {
      resetAllStates();
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    }),
    server,
  };
}

function parsePortArgument(args: string[]) {
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== "--port") {
      continue;
    }

    const value = Number(args[index + 1]);

    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return 44556;
}

async function main() {
  const port = parsePortArgument(process.argv.slice(2));
  startFakeOpencodeServer(port);
  process.stdout.write(`[fake-opencode] http://127.0.0.1:${port}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
