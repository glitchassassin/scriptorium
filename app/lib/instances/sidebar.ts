import type { InstanceRecord, OpencodeSessionSummary } from "~/lib/instances/types";
import type { OpencodeSessionInfo } from "~/lib/opencode/events";

export const SIDEBAR_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const SIDEBAR_SESSION_LIMIT = 3;

export type SidebarInstanceRecord = Pick<InstanceRecord, "id" | "name" | "status"> & {
  recentSessions: OpencodeSessionSummary[];
};

export function toSessionSummary(info: OpencodeSessionInfo): OpencodeSessionSummary {
  return {
    id: info.id,
    title: info.title ?? null,
    directory: info.directory ?? null,
    createdAt: info.time?.created ?? null,
    updatedAt: info.time?.updated ?? null,
  };
}

export function getSessionSortTime(session: OpencodeSessionSummary) {
  return session.updatedAt ?? session.createdAt ?? 0;
}

export function sortSessions(sessions: OpencodeSessionSummary[]) {
  return [...sessions].sort((left, right) => getSessionSortTime(right) - getSessionSortTime(left));
}

export function filterRecentSessions(sessions: OpencodeSessionSummary[], now = Date.now()) {
  return sortSessions(sessions)
    .filter((session) => {
      const sortTime = getSessionSortTime(session);

      return sortTime > 0 && now - sortTime <= SIDEBAR_SESSION_MAX_AGE_MS;
    });
}

export function sortSidebarInstances(instances: SidebarInstanceRecord[]) {
  return [...instances].sort((left, right) => left.name.localeCompare(right.name));
}
