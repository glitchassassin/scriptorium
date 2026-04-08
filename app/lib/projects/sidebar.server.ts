import {
  getOpencodeSession,
  getOpencodeSessionStatuses,
  listOpencodeQuestionRequests,
  listRecentSidebarSessions,
} from "~/lib/projects/opencode.server";
import {
  isRootSession,
  sortSessions,
  toSessionSummary,
  withSessionReadState,
  type SidebarProjectRecord,
} from "~/lib/projects/sidebar";
import type { OpencodeSessionStatus, OpencodeQuestionRequest } from "~/lib/opencode/events";
import type { OpencodeSessionSummary, ProjectRecord } from "~/lib/projects/types";

const IDLE_SESSION_STATUS = { type: "idle" } as const satisfies OpencodeSessionStatus;
const SIDEBAR_CACHE_TTL_MS = 5_000;

type CachedSidebarData = {
  expiresAt: number;
  value: {
    questions: OpencodeQuestionRequest[];
    recentSessions: OpencodeSessionSummary[];
    sessionStatuses: Record<string, OpencodeSessionStatus>;
  };
};

const sidebarDataCache = new Map<string, CachedSidebarData>();

export type SidebarProjectState = SidebarProjectRecord & {
  recentSessionStatuses: Record<string, OpencodeSessionStatus>;
};

async function loadSidebarData(project: ProjectRecord) {
  // The app shell reloads sidebar data often, so keep a short-lived snapshot
  // per project instead of refetching several OpenCode endpoints every time.
  const now = Date.now();
  const cached = sidebarDataCache.get(project.id);

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const [questions, recentSessions, sessionStatuses] = await Promise.all([
    listOpencodeQuestionRequests(project).catch(() => []),
    listRecentSidebarSessions(project).catch(() => []),
    getOpencodeSessionStatuses(project).catch(() => ({} as Record<string, OpencodeSessionStatus>)),
  ]);
  const value = {
    questions,
    recentSessions,
    sessionStatuses,
  };

  sidebarDataCache.set(project.id, {
    expiresAt: now + SIDEBAR_CACHE_TTL_MS,
    value,
  });

  return value;
}

function collectPendingQuestionRequestIdsBySession(questions: OpencodeQuestionRequest[]) {
  const pendingQuestionRequestIdsBySession = new Map<string, string[]>();

  for (const question of questions) {
    const pendingRequests = pendingQuestionRequestIdsBySession.get(question.sessionID) ?? [];
    pendingRequests.push(question.id);
    pendingQuestionRequestIdsBySession.set(question.sessionID, pendingRequests);
  }

  return pendingQuestionRequestIdsBySession;
}

async function loadPendingRootSessions(project: ProjectRecord, sessionIds: string[]) {
  const loadedSessions = await Promise.all(sessionIds.map(async (sessionId) => {
    try {
      return toSessionSummary(await getOpencodeSession(project, sessionId));
    } catch {
      return null;
    }
  }));

  return loadedSessions.filter((session): session is NonNullable<typeof session> => session !== null).filter(isRootSession);
}

export async function loadSidebarProjectState(
  project: ProjectRecord,
  readStatusMap: ReadonlyMap<string, number | null>,
) {
  const { questions, recentSessions, sessionStatuses } = await loadSidebarData(project);
  const pendingQuestionRequestIdsBySession = collectPendingQuestionRequestIdsBySession(questions);
  const sidebarSessionsById = new Map<string, OpencodeSessionSummary>(recentSessions.map((session) => [session.id, session]));
  const pendingQuestionSessionIds = [...pendingQuestionRequestIdsBySession.keys()].filter((sessionId) => !sidebarSessionsById.has(sessionId));

  for (const session of await loadPendingRootSessions(project, pendingQuestionSessionIds)) {
    sidebarSessionsById.set(session.id, session);
  }

  const sidebarSessions = sortSessions([...sidebarSessionsById.values()]).map((session) => withSessionReadState(
    session,
    readStatusMap.get(session.id) ?? null,
    pendingQuestionRequestIdsBySession.get(session.id) ?? [],
  ));

  return {
    id: project.id,
    name: project.name,
    directory: project.directory,
    recentSessions: sidebarSessions,
    recentSessionStatuses: Object.fromEntries(
      sidebarSessions.map((session) => [session.id, sessionStatuses[session.id] ?? IDLE_SESSION_STATUS] as const),
    ),
  } satisfies SidebarProjectState;
}
