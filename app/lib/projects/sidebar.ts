import type { ProjectRecord, OpencodeSessionSummary } from "~/lib/projects/types";
import type { OpencodeSessionInfo } from "~/lib/opencode/events";

export const SIDEBAR_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const SIDEBAR_SESSION_LIMIT = 3;
export const SESSION_UNREAD_GRACE_MS = 500;

export type SidebarSessionRecord = OpencodeSessionSummary & {
  lastReadAt: number | null;
  pendingQuestionRequestIds?: string[];
};

export type SidebarProjectRecord = Pick<ProjectRecord, "id" | "name" | "directory"> & {
  recentSessions: SidebarSessionRecord[];
};

export function toSessionSummary(info: OpencodeSessionInfo): OpencodeSessionSummary {
  return {
    id: info.id,
    parentID: info.parentID ?? null,
    title: info.title ?? null,
    directory: info.directory ?? null,
    createdAt: info.time?.created ?? null,
    updatedAt: info.time?.updated ?? null,
  };
}

export function isRootSession(session: { parentID?: string | null }) {
  return !session.parentID;
}

export function getSessionSortTime(session: OpencodeSessionSummary) {
  return session.updatedAt ?? session.createdAt ?? 0;
}

export function isSessionUnread(session: OpencodeSessionSummary, lastReadAt: number | null) {
  const pendingQuestionRequestIds = (session as SidebarSessionRecord).pendingQuestionRequestIds;

  if ((pendingQuestionRequestIds?.length ?? 0) > 0) {
    return true;
  }

  const sortTime = getSessionSortTime(session);

  if (sortTime <= 0) {
    return false;
  }

  if (lastReadAt === null) {
    return true;
  }

  return sortTime - lastReadAt > SESSION_UNREAD_GRACE_MS;
}

export function isSessionUnreadByActivity(session: OpencodeSessionSummary, lastReadAt: number | null) {
  const sortTime = getSessionSortTime(session);

  if (sortTime <= 0) {
    return false;
  }

  if (lastReadAt === null) {
    return true;
  }

  return sortTime - lastReadAt > SESSION_UNREAD_GRACE_MS;
}

export function withSessionReadState(
  session: OpencodeSessionSummary,
  lastReadAt: number | null,
  pendingQuestionRequestIds: string[] = [],
): SidebarSessionRecord {
  return {
    ...session,
    lastReadAt,
    pendingQuestionRequestIds,
  };
}

export function sortSessions<TSession extends OpencodeSessionSummary>(sessions: TSession[]) {
  return [...sessions].sort((left, right) => getSessionSortTime(right) - getSessionSortTime(left));
}

export function filterRecentSessions<TSession extends OpencodeSessionSummary>(sessions: TSession[], now = Date.now()) {
  return sortSessions(sessions)
    .filter((session) => {
      const sortTime = getSessionSortTime(session);

      return sortTime > 0 && now - sortTime <= SIDEBAR_SESSION_MAX_AGE_MS;
    });
}

export function sortSidebarProjects<TProject extends SidebarProjectRecord>(projects: TProject[]) {
  return [...projects].sort((left, right) => left.name.localeCompare(right.name));
}
