import {
  opencodeMessageWithPartsSchema,
  opencodeCommandInputSchema,
  opencodeCommandInfoSchema,
  opencodePermissionRequestSchema,
  opencodeQuestionRequestSchema,
  opencodeAgentSchema,
  opencodeProviderCatalogSchema,
  opencodePromptInputSchema,
  opencodeSessionInfoSchema,
  opencodeSessionStatusMapSchema,
  opencodeSessionSummarySchema,
} from "~/lib/opencode/events";
import { type OpencodeMessagePage } from "~/lib/opencode/message-page";
import type {
  InstanceRecord,
  OpencodeSessionStatus,
  OpencodeSessionSummary,
} from "~/lib/instances/types";
import { filterRecentSessions, isRootSession } from "~/lib/instances/sidebar";

import type {
  OpencodeMessageWithParts,
  OpencodeAgent,
  OpencodeCommandInfo,
  OpencodeCommandInput,
  OpencodePromptInput,
  OpencodeProviderCatalog,
  OpencodePermissionRequest,
  OpencodeQuestionAnswer,
  OpencodeQuestionRequest,
  OpencodeSessionInfo,
} from "~/lib/opencode/events";

function getInstanceBaseUrl(instance: InstanceRecord) {
  return `http://127.0.0.1:${instance.port}`;
}

async function readJson(response: Response) {
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.json();
}

function parseOrThrow<Result>(result: { success: true; data: Result } | { success: false; error: { message: string } }) {
  if (!result.success) {
    throw new Error(result.error.message);
  }

  return result.data;
}

export async function listOpencodeSessions(instance: InstanceRecord) {
  const payload = await readJson(await fetch(`${getInstanceBaseUrl(instance)}/session`));

  return parseOrThrow(opencodeSessionSummarySchema.array().safeParse(payload)).sort(
    (left, right) => (right.updatedAt ?? right.createdAt ?? 0) - (left.updatedAt ?? left.createdAt ?? 0),
  );
}

export async function listRecentSidebarSessions(instance: InstanceRecord, now = Date.now()) {
  return filterRecentSessions(await listOpencodeSessions(instance), now).filter(isRootSession);
}

export async function getOpencodeSession(instance: InstanceRecord, sessionId: string) {
  const payload = await readJson(await fetch(`${getInstanceBaseUrl(instance)}/session/${sessionId}`));
  return parseOrThrow(opencodeSessionInfoSchema.safeParse(payload)) satisfies OpencodeSessionInfo;
}

export async function createOpencodeSession(instance: InstanceRecord, input?: { title?: string }) {
  const response = await fetch(`${getInstanceBaseUrl(instance)}/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input ?? {}),
  });

  return parseOrThrow(opencodeSessionInfoSchema.safeParse(await readJson(response))) satisfies OpencodeSessionInfo;
}

export async function listOpencodeMessagePage(
  instance: InstanceRecord,
  sessionId: string,
  input?: { before?: string; limit?: number },
) {
  const searchParams = new URLSearchParams();

  if (input?.limit !== undefined) {
    searchParams.set("limit", String(input.limit));
  }

  if (input?.before) {
    searchParams.set("before", input.before);
  }

  const suffix = searchParams.size ? `?${searchParams.toString()}` : "";
  const response = await fetch(`${getInstanceBaseUrl(instance)}/session/${sessionId}/message${suffix}`);
  const payload = await readJson(response);
  const items = parseOrThrow(opencodeMessageWithPartsSchema.array().safeParse(payload)) satisfies OpencodeMessageWithParts[];
  const nextCursor = response.headers.get("x-next-cursor");

  return {
    hasMore: nextCursor !== null,
    items,
    nextCursor,
  } satisfies OpencodeMessagePage;
}

export async function listOpencodeMessages(instance: InstanceRecord, sessionId: string, limit?: number) {
  return (await listOpencodeMessagePage(instance, sessionId, { limit })).items;
}

export async function getOpencodeSessionStatuses(instance: InstanceRecord) {
  const payload = await readJson(await fetch(`${getInstanceBaseUrl(instance)}/session/status`));
  return parseOrThrow(opencodeSessionStatusMapSchema.safeParse(payload)) satisfies Record<string, OpencodeSessionStatus>;
}

export async function listOpencodePermissionRequests(instance: InstanceRecord, sessionId?: string) {
  const payload = await readJson(await fetch(`${getInstanceBaseUrl(instance)}/permission`));
  const permissions = parseOrThrow(
    opencodePermissionRequestSchema.array().safeParse(payload),
  ) satisfies OpencodePermissionRequest[];

  if (!sessionId) {
    return permissions;
  }

  return permissions.filter((permission) => permission.sessionID === sessionId);
}

export async function listOpencodeQuestionRequests(instance: InstanceRecord, sessionId?: string) {
  const payload = await readJson(await fetch(`${getInstanceBaseUrl(instance)}/question`));
  const questions = parseOrThrow(
    opencodeQuestionRequestSchema.array().safeParse(payload),
  ) satisfies OpencodeQuestionRequest[];

  if (!sessionId) {
    return questions;
  }

  return questions.filter((question) => question.sessionID === sessionId);
}

export async function listOpencodeAgents(instance: InstanceRecord) {
  const payload = await readJson(await fetch(`${getInstanceBaseUrl(instance)}/agent`));
  return parseOrThrow(opencodeAgentSchema.array().safeParse(payload)) satisfies OpencodeAgent[];
}

export async function listOpencodeCommands(instance: InstanceRecord) {
  const payload = await readJson(await fetch(`${getInstanceBaseUrl(instance)}/command`));
  return parseOrThrow(opencodeCommandInfoSchema.array().safeParse(payload)) satisfies OpencodeCommandInfo[];
}

export async function getOpencodeProviderCatalog(instance: InstanceRecord) {
  const response = await fetch(`${getInstanceBaseUrl(instance)}/config/providers`);

  if (response.status === 404 || response.status === 501) {
    return { default: {}, providers: [] } satisfies OpencodeProviderCatalog;
  }

  const payload = await readJson(response);
  return parseOrThrow(opencodeProviderCatalogSchema.safeParse(payload)) satisfies OpencodeProviderCatalog;
}

export async function submitOpencodePrompt(
  instance: InstanceRecord,
  sessionId: string,
  input: {
    parts: OpencodePromptInput["parts"];
    agent?: string | null;
    model?: OpencodePromptInput["model"];
    variant?: string | null;
  },
) {
  const nextPayload = {
    parts: input.parts,
    ...(input.agent ? { agent: input.agent } : {}),
    ...(input.model ? { model: input.model } : {}),
    ...(input.variant ? { variant: input.variant } : {}),
  };

  const parsedPayload = parseOrThrow(
    opencodePromptInputSchema.safeParse(nextPayload),
  );

  const response = await fetch(`${getInstanceBaseUrl(instance)}/session/${sessionId}/prompt_async`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parsedPayload),
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Prompt request failed with ${response.status}`);
  }
}

export async function submitOpencodeCommand(
  instance: InstanceRecord,
  sessionId: string,
  input: {
    command: string;
    arguments: string;
    parts?: OpencodeCommandInput["parts"];
    agent?: string | null;
    model?: string;
    variant?: string | null;
  },
) {
  const nextPayload = {
    arguments: input.arguments,
    command: input.command,
    ...(input.parts ? { parts: input.parts } : {}),
    ...(input.agent ? { agent: input.agent } : {}),
    ...(input.model ? { model: input.model } : {}),
    ...(input.variant ? { variant: input.variant } : {}),
  };

  const parsedPayload = parseOrThrow(
    opencodeCommandInputSchema.safeParse(nextPayload),
  );

  const response = await fetch(`${getInstanceBaseUrl(instance)}/session/${sessionId}/command`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parsedPayload),
  });

  if (!response.ok) {
    throw new Error(`Command request failed with ${response.status}`);
  }
}

export async function abortOpencodeSession(instance: InstanceRecord, sessionId: string) {
  const response = await fetch(`${getInstanceBaseUrl(instance)}/session/${sessionId}/abort`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Abort request failed with ${response.status}`);
  }
}

export async function revertOpencodeSession(
  instance: InstanceRecord,
  sessionId: string,
  input: { messageId: string; partId?: string },
) {
  const response = await fetch(`${getInstanceBaseUrl(instance)}/session/${sessionId}/revert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messageID: input.messageId,
      ...(input.partId ? { partID: input.partId } : {}),
    }),
  });

  return parseOrThrow(opencodeSessionInfoSchema.safeParse(await readJson(response))) satisfies OpencodeSessionInfo;
}

export async function unrevertOpencodeSession(instance: InstanceRecord, sessionId: string) {
  const response = await fetch(`${getInstanceBaseUrl(instance)}/session/${sessionId}/unrevert`, {
    method: "POST",
  });

  return parseOrThrow(opencodeSessionInfoSchema.safeParse(await readJson(response))) satisfies OpencodeSessionInfo;
}

export async function forkOpencodeSession(instance: InstanceRecord, sessionId: string, input?: { messageId?: string }) {
  const response = await fetch(`${getInstanceBaseUrl(instance)}/session/${sessionId}/fork`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...(input?.messageId ? { messageID: input.messageId } : {}),
    }),
  });

  return parseOrThrow(opencodeSessionInfoSchema.safeParse(await readJson(response))) satisfies OpencodeSessionInfo;
}

export async function replyToOpencodeQuestionRequest(
  instance: InstanceRecord,
  requestId: string,
  answers: OpencodeQuestionAnswer[],
) {
  const response = await fetch(`${getInstanceBaseUrl(instance)}/question/${requestId}/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ answers }),
  });

  if (!response.ok) {
    throw new Error(`Question reply failed with ${response.status}`);
  }
}

export async function rejectOpencodeQuestionRequest(instance: InstanceRecord, requestId: string) {
  const response = await fetch(`${getInstanceBaseUrl(instance)}/question/${requestId}/reject`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Question reject failed with ${response.status}`);
  }
}
