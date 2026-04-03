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

export type SidebarProjectState = SidebarProjectRecord & {
  recentSessionStatuses: Record<string, OpencodeSessionStatus>;
};

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
  const [recentSessions, sessionStatuses, questions] = await Promise.all([
    listRecentSidebarSessions(project).catch(() => []),
    getOpencodeSessionStatuses(project).catch(() => ({} as Record<string, OpencodeSessionStatus>)),
    listOpencodeQuestionRequests(project).catch(() => []),
  ]);
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
