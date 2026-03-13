import type { InstanceRecord, OpencodeSessionSummary } from "~/lib/instances/types";

function getInstanceBaseUrl(instance: InstanceRecord) {
  return `http://127.0.0.1:${instance.port}`;
}

export async function listOpencodeSessions(instance: InstanceRecord) {
  const response = await fetch(`${getInstanceBaseUrl(instance)}/session`);

  if (!response.ok) {
    throw new Error(`Session request failed with ${response.status}`);
  }

  const payload = (await response.json()) as Array<{
    id: string;
    title?: string;
    directory?: string;
    time?: {
      created?: number;
      updated?: number;
    };
  }>;

  return payload
    .map<OpencodeSessionSummary>((session) => ({
      id: session.id,
      title: session.title ?? null,
      directory: session.directory ?? null,
      createdAt: session.time?.created ?? null,
      updatedAt: session.time?.updated ?? null,
    }))
    .sort((left, right) => (right.updatedAt ?? right.createdAt ?? 0) - (left.updatedAt ?? left.createdAt ?? 0));
}
