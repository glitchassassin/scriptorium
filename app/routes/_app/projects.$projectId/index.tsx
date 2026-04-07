import { useEffect, useMemo, useState } from "react";
import { data, Form, redirect, useFetcher } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import { useProjectEvents } from "~/components/events/project-events-provider";
import { Breadcrumbs } from "~/components/shell/breadcrumbs";
import { ScrollableLayout } from "~/components/shell/scrollable-layout";
import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { getDocumentTitle } from "~/lib/document-title";
import { getGitStatusSummary } from "~/lib/projects/git.server";
import {
  createOpencodeSession,
  getOpencodeSessionStatuses,
  listOpencodeQuestionRequests,
  listOpencodeSessions,
  removeOpencodeSession,
} from "~/lib/projects/opencode.server";
import {
  isSessionUnreadByActivity,
  sortSessions,
  toSessionSummary,
  withSessionReadState,
  type SidebarSessionRecord,
} from "~/lib/projects/sidebar";
import { getProjectOrThrow } from "~/lib/projects/runtime.server";
import { opencodeSessionMutationEventSchema, type OpencodeQuestionRequest } from "~/lib/opencode/events";
import { getServerTimingHeaders, makeTimings, time } from "~/lib/server-timing.server";
import { listSessionReadStatuses, markSessionRead } from "~/lib/session-read-status.server";
import { useHydrateSessionState, useSessions } from "~/store/sessions-provider";

import { getProjectName } from "./+/project-route";
import { ProjectSessionList } from "./+/project-session-list";

import type { Route } from "./+types/index";

function collectPendingQuestionRequestIdsBySession(questions: OpencodeQuestionRequest[]) {
  const pendingQuestionRequestIdsBySession = new Map<string, string[]>();

  for (const question of questions) {
    const requestIds = pendingQuestionRequestIdsBySession.get(question.sessionID) ?? [];
    requestIds.push(question.id);
    pendingQuestionRequestIdsBySession.set(question.sessionID, requestIds);
  }

  return pendingQuestionRequestIdsBySession;
}

function withProjectSessionReadState(
  sessions: Awaited<ReturnType<typeof listOpencodeSessions>>,
  readStatuses: Awaited<ReturnType<typeof listSessionReadStatuses>>,
  questions: OpencodeQuestionRequest[],
) {
  const readStatusMap = new Map(readStatuses.map((status) => [status.sessionId, status.lastReadAt] as const));
  const pendingQuestionRequestIdsBySession = collectPendingQuestionRequestIdsBySession(questions);

  return sessions.map((session) => withSessionReadState(
    session,
    readStatusMap.get(session.id) ?? null,
    pendingQuestionRequestIdsBySession.get(session.id) ?? [],
  ));
}

function getTopLevelSessions(sessions: SidebarSessionRecord[]) {
  const ids = new Set(sessions.map((session) => session.id));

  return sessions.filter((session) => !session.parentID || !ids.has(session.parentID));
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const timings = makeTimings("project loader");

  await time(() => requireAuthenticatedPasskey(request), {
    desc: "require authenticated passkey",
    timings,
    type: "auth",
  });

  const project = await time(() => getProjectOrThrow(params.projectId), {
    desc: "get project",
    timings,
    type: "project",
  });
  const git = await time(() => getGitStatusSummary(project.directory), {
    desc: "get git summary",
    timings,
    type: "git",
  });

  try {
    const [sessions, readStatuses, questions, sessionStatuses] = await Promise.all([
      time(() => listOpencodeSessions(project), {
        desc: "list recent sessions",
        timings,
        type: "sessions",
      }),
      time(() => listSessionReadStatuses(), {
        desc: "list read statuses",
        timings,
        type: "read statuses",
      }),
      time(() => listOpencodeQuestionRequests(project), {
        desc: "list question requests",
        timings,
        type: "questions",
      }),
      time(() => getOpencodeSessionStatuses(project), {
        desc: "list session statuses",
        timings,
        type: "session statuses",
      }),
    ]);
    const sessionsWithReadState = withProjectSessionReadState(sessions, readStatuses, questions);

    return data(
      {
        git,
        project,
        recentSessions: sessionsWithReadState,
        recentSessionStatuses: sessionStatuses,
        sessionError: null,
      },
      {
        headers: {
          "Server-Timing": timings.toString(),
        },
      },
    );
  } catch (error) {
    return data(
      {
        git,
        project,
        recentSessions: [],
        recentSessionStatuses: {},
        sessionError: error instanceof Error ? error.message : "Failed to load sessions.",
      },
      {
        headers: {
          "Server-Timing": timings.toString(),
        },
      },
    );
  }
}

export function headers(args: Route.HeadersArgs) {
  return getServerTimingHeaders(args);
}

export async function action({ params, request }: Route.ActionArgs) {
  await requireAuthenticatedPasskey(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "").trim();

  if (intent === "create-session") {
    const project = await getProjectOrThrow(params.projectId);
    const session = await createOpencodeSession(project);
    return redirect(`/projects/${params.projectId}/sessions/${session.id}`);
  }

  if (intent === "delete-session") {
    const sessionId = String(formData.get("sessionId") || "").trim();

    if (!sessionId) {
      return data({ error: "Choose a session to delete." }, { status: 400 });
    }

    const project = await getProjectOrThrow(params.projectId);
    await removeOpencodeSession(project, sessionId);
    return data({ error: null });
  }

  if (intent === "mark-all-read") {
    const project = await getProjectOrThrow(params.projectId);
    const [sessions, readStatuses, questions] = await Promise.all([
      listOpencodeSessions(project),
      listSessionReadStatuses(),
      listOpencodeQuestionRequests(project),
    ]);
    const unreadRootSessions = getTopLevelSessions(withProjectSessionReadState(sessions, readStatuses, questions))
      .filter((session) => isSessionUnreadByActivity(session, session.lastReadAt));

    for (const session of unreadRootSessions) {
      markSessionRead({ sessionId: session.id });
    }

    return data({ error: null, markedReadCount: unreadRootSessions.length });
  }

  return data({ error: "That action is not supported." }, { status: 400 });
}

function ProjectOverviewHeader({ directory, git }: { directory: string; git: Route.ComponentProps["loaderData"]["git"] }) {
  return (
    <div className="grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <div className="min-w-0">
        <p className="truncate text-base font-bold">{directory}</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-sm leading-6 opacity-60">
        {git.isRepository ? (
          <>
            <span className="inline-flex items-center gap-0">
              <Icon className="size-4" icon="mdi:source-branch" />
              {git.branch ?? "HEAD"}
            </span>
            <span className="inline-flex items-center gap-0">
              <Icon className="size-4" icon="mdi:arrow-up" />
              {git.ahead}
              <Icon className="size-4" icon="mdi:arrow-down" />
              {git.behind}
            </span>
            <span className="inline-flex items-center gap-0">
              <Icon className="size-4" icon="mdi:file-upload-outline" />
              {git.staged}
            </span>
            <span className="inline-flex items-center gap-0">
              <Icon className="size-4" icon="mdi:file-document-edit-outline" />
              {git.modified}
            </span>
            <span className="inline-flex items-center gap-0">
              <Icon className="size-4" icon="mdi:file-question-outline" />
              {git.untracked}
            </span>
          </>
        ) : (
          <span>Not a git repository</span>
        )}
      </div>
    </div>
  );
}

export default function ProjectDetailRoute({ loaderData, matches }: Route.ComponentProps) {
  const { git, project, recentSessions, recentSessionStatuses, sessionError } = loaderData;
  const [sessions, setSessions] = useState<SidebarSessionRecord[]>(() => sortSessions(recentSessions));
  const sessionEventTypes = useMemo(
    () => ["session.created", "session.updated", "session.deleted"] as const,
    [],
  );
  const sessionStateById = useSessions();
  const markAllReadFetcher = useFetcher();
  const hydratedSessions = useMemo(
    () => Object.fromEntries(sessions.map((session) => [session.id, session] as const)),
    [sessions],
  );
  const unreadRootSessionCount = useMemo(
    () => getTopLevelSessions(sessions).filter((session) => {
      const liveSession = sessionStateById[session.id] ?? session;

      return isSessionUnreadByActivity(liveSession, liveSession.lastReadAt);
    }).length,
    [sessionStateById, sessions],
  );
  useHydrateSessionState(hydratedSessions, recentSessionStatuses);

  useEffect(() => {
    setSessions(sortSessions(recentSessions));
  }, [recentSessions, project.id]);

  useProjectEvents(
    (event) => {
      const result = opencodeSessionMutationEventSchema.safeParse(event);

      if (!result.success) {
        return;
      }

      const session = toSessionSummary(result.data.properties.info);

      setSessions((currentSessions) => {
        if (result.data.type === "session.deleted") {
          return currentSessions.filter((currentSession) => currentSession.id !== session.id);
        }

        const previous = currentSessions.find((currentSession) => currentSession.id === session.id);
        const nextSessions = currentSessions.filter((currentSession) => currentSession.id !== session.id);
        nextSessions.push(withSessionReadState(
          session,
          previous?.lastReadAt ?? null,
          previous?.pendingQuestionRequestIds ?? [],
        ));
        return sortSessions(nextSessions);
      });
    },
    { projectId: project.id, types: sessionEventTypes },
  );

  return (
    <>
      <title>{getDocumentTitle(getProjectName(project.name))}</title>
      <Breadcrumbs depth={matches.length}>
        <Breadcrumbs.Item to={`/projects/${project.id}`}>{project.name}</Breadcrumbs.Item>
      </Breadcrumbs>
      <ScrollableLayout header={<ProjectOverviewHeader directory={project.directory} git={git} />}>
        <section className="space-y-8 pt-6 pr-1">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 px-6 sm:px-8">
              <p className="text-sm uppercase tracking-[0.08em]">Recent sessions</p>
              <div className="flex items-center gap-3">
                {unreadRootSessionCount > 0 ? (
                  <markAllReadFetcher.Form method="post">
                    <input name="intent" type="hidden" value="mark-all-read" />
                    <button className="min-h-11 border-2 border-black px-3 py-2 text-base disabled:opacity-25" disabled={markAllReadFetcher.state !== "idle"} type="submit">
                      Mark all as read
                    </button>
                  </markAllReadFetcher.Form>
                ) : null}
                <Form method="post">
                  <input name="intent" type="hidden" value="create-session" />
                  <button className="min-h-11 bg-black px-3 py-2 text-base text-white" type="submit">
                    New session
                  </button>
                </Form>
              </div>
            </div>
            {sessionError ? <p className="text-base leading-6">{sessionError}</p> : null}
            <ProjectSessionList projectId={project.id} sessions={sessions} initialSessionStatuses={recentSessionStatuses} />
          </section>
        </section>
      </ScrollableLayout>
    </>
  );
}
