import type { OpencodePermissionRequest } from "~/lib/opencode/events";

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
