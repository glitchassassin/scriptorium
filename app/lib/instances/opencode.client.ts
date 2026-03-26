import type {
  OpencodePermissionRequest,
  OpencodeQuestionAnswer,
  OpencodeQuestionRequest,
} from "~/lib/opencode/events";

function getInstanceProxyPath(instanceId: string, path: string) {
  return `/instances/${instanceId}/proxy${path}`;
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
