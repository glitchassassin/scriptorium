import {
  opencodeMessageWithPartsSchema,
  opencodeCommandInputSchema,
  opencodeCommandInfoSchema,
  opencodeFileDiffSchema,
  opencodePermissionRequestSchema,
  opencodeQuestionRequestSchema,
  opencodeAgentSchema,
  opencodeConfigSchema,
  opencodeProviderCatalogSchema,
  opencodePromptInputSchema,
  opencodeSessionInfoSchema,
  opencodeSessionStatusMapSchema,
  opencodeSessionSummarySchema,
} from "~/lib/opencode/events";
import { type OpencodeMessagePage } from "~/lib/opencode/message-page";
import type {
  ProjectRecord,
  OpencodeSessionStatus,
  OpencodeSessionSummary,
} from "~/lib/projects/types";
import { filterRecentSessions, isRootSession } from "~/lib/projects/sidebar";
import { createProjectScopedHeaders, getSharedOpencodeServerUrl } from "~/lib/opencode/shared-runtime.server";

import type {
  OpencodeMessageWithParts,
  OpencodeAgent,
  OpencodeCommandInfo,
  OpencodeConfig,
  OpencodeCommandInput,
  OpencodePromptInput,
  OpencodeProviderCatalog,
  OpencodePermissionRequest,
  OpencodeQuestionAnswer,
  OpencodeQuestionRequest,
  OpencodeSessionInfo,
} from "~/lib/opencode/events";

async function fetchFromProject(project: ProjectRecord, path: string, init?: RequestInit) {
  const baseUrl = await getSharedOpencodeServerUrl();

  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: createProjectScopedHeaders(project.directory, init?.headers),
  });
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

export async function listOpencodeSessions(project: ProjectRecord) {
  const payload = await readJson(await fetchFromProject(project, "/session"));

  return parseOrThrow(opencodeSessionSummarySchema.array().safeParse(payload)).sort(
    (left, right) => (right.updatedAt ?? right.createdAt ?? 0) - (left.updatedAt ?? left.createdAt ?? 0),
  );
}

export async function listRecentSidebarSessions(project: ProjectRecord, now = Date.now()) {
  return filterRecentSessions(await listOpencodeSessions(project), now).filter(isRootSession);
}

export async function getOpencodeSession(project: ProjectRecord, sessionId: string) {
  const payload = await readJson(await fetchFromProject(project, `/session/${sessionId}`));
  return parseOrThrow(opencodeSessionInfoSchema.safeParse(payload)) satisfies OpencodeSessionInfo;
}

export async function createOpencodeSession(project: ProjectRecord, input?: { title?: string }) {
  const response = await fetchFromProject(project, "/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input ?? {}),
  });

  return parseOrThrow(opencodeSessionInfoSchema.safeParse(await readJson(response))) satisfies OpencodeSessionInfo;
}

export async function listOpencodeMessagePage(
  project: ProjectRecord,
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
  const response = await fetchFromProject(project, `/session/${sessionId}/message${suffix}`);
  const payload = await readJson(response);
  const items = parseOrThrow(opencodeMessageWithPartsSchema.array().safeParse(payload)) satisfies OpencodeMessageWithParts[];
  const nextCursor = response.headers.get("x-next-cursor");

  return {
    hasMore: nextCursor !== null,
    items,
    nextCursor,
  } satisfies OpencodeMessagePage;
}

export async function listOpencodeMessages(project: ProjectRecord, sessionId: string, limit?: number) {
  return (await listOpencodeMessagePage(project, sessionId, { limit })).items;
}

export async function getOpencodeSessionDiff(project: ProjectRecord, sessionId: string) {
  const payload = await readJson(await fetchFromProject(project, `/session/${sessionId}/diff`));
  return parseOrThrow(opencodeFileDiffSchema.array().safeParse(payload));
}

export async function getOpencodeSessionStatuses(project: ProjectRecord) {
  const payload = await readJson(await fetchFromProject(project, "/session/status"));
  return parseOrThrow(opencodeSessionStatusMapSchema.safeParse(payload)) satisfies Record<string, OpencodeSessionStatus>;
}

export async function listOpencodePermissionRequests(project: ProjectRecord, sessionId?: string) {
  const payload = await readJson(await fetchFromProject(project, "/permission"));
  const permissions = parseOrThrow(
    opencodePermissionRequestSchema.array().safeParse(payload),
  ) satisfies OpencodePermissionRequest[];

  if (!sessionId) {
    return permissions;
  }

  return permissions.filter((permission) => permission.sessionID === sessionId);
}

export async function listOpencodeQuestionRequests(project: ProjectRecord, sessionId?: string) {
  const payload = await readJson(await fetchFromProject(project, "/question"));
  const questions = parseOrThrow(
    opencodeQuestionRequestSchema.array().safeParse(payload),
  ) satisfies OpencodeQuestionRequest[];

  if (!sessionId) {
    return questions;
  }

  return questions.filter((question) => question.sessionID === sessionId);
}

export async function listOpencodeAgents(project: ProjectRecord) {
  const payload = await readJson(await fetchFromProject(project, "/agent"));
  return parseOrThrow(opencodeAgentSchema.array().safeParse(payload)) satisfies OpencodeAgent[];
}

export async function listOpencodeCommands(project: ProjectRecord) {
  const payload = await readJson(await fetchFromProject(project, "/command"));
  return parseOrThrow(opencodeCommandInfoSchema.array().safeParse(payload)) satisfies OpencodeCommandInfo[];
}

export async function getOpencodeProviderCatalog(project: ProjectRecord) {
  const response = await fetchFromProject(project, "/config/providers");

  if (response.status === 404 || response.status === 501) {
    return { default: {}, providers: [] } satisfies OpencodeProviderCatalog;
  }

  const payload = await readJson(response);
  return parseOrThrow(opencodeProviderCatalogSchema.safeParse(payload)) satisfies OpencodeProviderCatalog;
}

export async function getOpencodeConfig(project: ProjectRecord) {
  const response = await fetchFromProject(project, "/config");

  if (response.status === 404 || response.status === 501) {
    return {} satisfies OpencodeConfig;
  }

  const payload = await readJson(response);
  return parseOrThrow(opencodeConfigSchema.safeParse(payload)) satisfies OpencodeConfig;
}

export async function submitOpencodePrompt(
  project: ProjectRecord,
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

  const response = await fetchFromProject(project, `/session/${sessionId}/prompt_async`, {
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
  project: ProjectRecord,
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

  const response = await fetchFromProject(project, `/session/${sessionId}/command`, {
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

export async function abortOpencodeSession(project: ProjectRecord, sessionId: string) {
  const response = await fetchFromProject(project, `/session/${sessionId}/abort`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Abort request failed with ${response.status}`);
  }
}

export async function revertOpencodeSession(
  project: ProjectRecord,
  sessionId: string,
  input: { messageId: string; partId?: string },
) {
  const response = await fetchFromProject(project, `/session/${sessionId}/revert`, {
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

export async function unrevertOpencodeSession(project: ProjectRecord, sessionId: string) {
  const response = await fetchFromProject(project, `/session/${sessionId}/unrevert`, {
    method: "POST",
  });

  return parseOrThrow(opencodeSessionInfoSchema.safeParse(await readJson(response))) satisfies OpencodeSessionInfo;
}

export async function forkOpencodeSession(project: ProjectRecord, sessionId: string, input?: { messageId?: string }) {
  const response = await fetchFromProject(project, `/session/${sessionId}/fork`, {
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
  project: ProjectRecord,
  requestId: string,
  answers: OpencodeQuestionAnswer[],
) {
  const response = await fetchFromProject(project, `/question/${requestId}/reply`, {
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

export async function rejectOpencodeQuestionRequest(project: ProjectRecord, requestId: string) {
  const response = await fetchFromProject(project, `/question/${requestId}/reject`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Question reject failed with ${response.status}`);
  }
}
