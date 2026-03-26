import type {
  OpencodeMessageWithParts,
  OpencodePermissionRequest,
  OpencodeQuestionAnswer,
  OpencodeQuestionRequest,
} from "~/lib/opencode/events";
import { opencodeMessageWithPartsSchema } from "~/lib/opencode/events";
import type { OpencodeMessagePage } from "~/lib/opencode/message-page";

function getInstanceProxyPath(instanceId: string, path: string) {
  return `/instances/${instanceId}/proxy${path}`;
}

function parseMessages(payload: unknown) {
  const result = opencodeMessageWithPartsSchema.array().safeParse(payload);

  if (!result.success) {
    throw new Error(result.error.message);
  }

  return result.data satisfies OpencodeMessageWithParts[];
}

export async function listOpencodeMessagePageClient(
  instanceId: string,
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
  const response = await fetch(getInstanceProxyPath(instanceId, `/session/${sessionId}/message${suffix}`));

  if (!response.ok) {
    throw new Error(`Message request failed with ${response.status}`);
  }

  const nextCursor = response.headers.get("x-next-cursor");

  return {
    hasMore: nextCursor !== null,
    items: parseMessages(await response.json()),
    nextCursor,
  } satisfies OpencodeMessagePage;
}

export async function listOpencodePermissionRequestsClient(instanceId: string, sessionId?: string) {
  const response = await fetch(getInstanceProxyPath(instanceId, "/permission"));

  if (!response.ok) {
    throw new Error(`Permission request failed with ${response.status}`);
  }

  const payload = (await response.json()) as OpencodePermissionRequest[];

  if (!sessionId) {
    return payload;
  }

  return payload.filter((permission) => permission.sessionID === sessionId);
}

export async function replyToOpencodePermissionRequest(
  instanceId: string,
  requestId: string,
  reply: "once" | "always" | "reject",
) {
  const response = await fetch(getInstanceProxyPath(instanceId, `/permission/${requestId}/reply`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reply }),
  });

  if (!response.ok) {
    throw new Error(`Permission reply failed with ${response.status}`);
  }
}

export async function listOpencodeQuestionRequestsClient(instanceId: string, sessionId?: string) {
  const response = await fetch(getInstanceProxyPath(instanceId, "/question"));

  if (!response.ok) {
    throw new Error(`Question request failed with ${response.status}`);
  }

  const payload = (await response.json()) as OpencodeQuestionRequest[];

  if (!sessionId) {
    return payload;
  }

  return payload.filter((question) => question.sessionID === sessionId);
}

export async function replyToOpencodeQuestionRequest(
  instanceId: string,
  requestId: string,
  answers: OpencodeQuestionAnswer[],
) {
  const response = await fetch(getInstanceProxyPath(instanceId, `/question/${requestId}/reply`), {
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

export async function rejectOpencodeQuestionRequest(instanceId: string, requestId: string) {
  const response = await fetch(getInstanceProxyPath(instanceId, `/question/${requestId}/reject`), {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Question reject failed with ${response.status}`);
  }
}
