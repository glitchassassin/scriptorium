import {
  opencodeMessageWithPartsSchema,
  opencodePermissionRequestSchema,
  opencodePromptInputSchema,
  opencodeSessionInfoSchema,
  opencodeSessionStatusMapSchema,
  opencodeSessionSummarySchema,
} from "~/lib/opencode/events";
import type {
  InstanceRecord,
  OpencodeSessionStatus,
  OpencodeSessionSummary,
} from "~/lib/instances/types";
import { filterRecentSessions } from "~/lib/instances/sidebar";

import type {
  OpencodeMessageWithParts,
  OpencodePermissionRequest,
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
  return filterRecentSessions(await listOpencodeSessions(instance), now);
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

export async function listOpencodeMessages(instance: InstanceRecord, sessionId: string, limit?: number) {
  const searchParams = new URLSearchParams();

  if (limit !== undefined) {
    searchParams.set("limit", String(limit));
  }

  const suffix = searchParams.size ? `?${searchParams.toString()}` : "";
  const payload = await readJson(await fetch(`${getInstanceBaseUrl(instance)}/session/${sessionId}/message${suffix}`));
  return parseOrThrow(opencodeMessageWithPartsSchema.array().safeParse(payload)) satisfies OpencodeMessageWithParts[];
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

export async function submitOpencodePrompt(instance: InstanceRecord, sessionId: string, input: { text: string }) {
  const payload = parseOrThrow(
    opencodePromptInputSchema.safeParse({
      parts: [
        {
          type: "text",
          text: input.text,
        },
      ],
    }),
  );

  const response = await fetch(`${getInstanceBaseUrl(instance)}/session/${sessionId}/prompt_async`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Prompt request failed with ${response.status}`);
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
