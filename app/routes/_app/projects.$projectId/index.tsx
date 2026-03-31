import { useEffect, useMemo, useState } from "react";
import { data, Form, redirect } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import { useProjectEvents } from "~/components/events/project-events-provider";
import { Breadcrumbs } from "~/components/shell/breadcrumbs";
import { ScrollableLayout } from "~/components/shell/scrollable-layout";
import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { getGitStatusSummary } from "~/lib/projects/git.server";
import { createOpencodeSession, listOpencodeSessions } from "~/lib/projects/opencode.server";
import { sortSessions, toSessionSummary } from "~/lib/projects/sidebar";
import { getProjectOrThrow, removeProject } from "~/lib/projects/runtime.server";
import type { OpencodeSessionSummary } from "~/lib/projects/types";
import { opencodeSessionMutationEventSchema } from "~/lib/opencode/events";
import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleDefinition } from "~/lib/route-handle";
import { getServerTimingHeaders, makeTimings, time } from "~/lib/server-timing.server";

import { getProjectBreadcrumbs } from "./+/project-route";
import { ProjectSessionList } from "./+/project-session-list";

import type { Route } from "./+types/index";

export const handle: RouteHandleDefinition<Route.ComponentProps> = defineRouteHandle<Route.ComponentProps>({
  title: (ctx) => getProjectBreadcrumbs(ctx.data.project.name, ctx.params.projectId),
});

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
    const sessions = await time(() => listOpencodeSessions(project), {
      desc: "list recent sessions",
      timings,
      type: "sessions",
    });

    return data(
      {
        git,
        project,
        recentSessions: sessions,
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

  await removeProject(params.projectId);

  return redirect("/projects");
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
  const { git, project, recentSessions, sessionError } = loaderData;
  const [sessions, setSessions] = useState<OpencodeSessionSummary[]>(() => sortSessions(recentSessions));
  const sessionEventTypes = useMemo(
    () => ["session.created", "session.updated", "session.deleted"] as const,
    [],
  );

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

        const nextSessions = currentSessions.filter((currentSession) => currentSession.id !== session.id);
        nextSessions.push(session);
        return sortSessions(nextSessions);
      });
    },
    { projectId: project.id, types: sessionEventTypes },
  );

  return (
    <>
      <Breadcrumbs depth={matches.length}>
        <Breadcrumbs.Item to={`/projects/${project.id}`}>{project.name}</Breadcrumbs.Item>
      </Breadcrumbs>
      <ScrollableLayout
          header={<ProjectOverviewHeader directory={project.directory} git={git} />}
        footer={
          <Form method="post">
            <button className="min-h-11 bg-black px-3 py-2 text-base text-white" type="submit">
              Remove project
            </button>
          </Form>
        }
      >
        <section className="space-y-8 pt-6 pr-1">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 px-6 sm:px-8">
              <p className="text-sm uppercase tracking-[0.08em]">Recent sessions</p>
              <Form method="post">
                <input name="intent" type="hidden" value="create-session" />
                <button className="min-h-11 bg-black px-3 py-2 text-base text-white" type="submit">
                  New session
                </button>
              </Form>
            </div>
            {sessionError ? <p className="text-base leading-6">{sessionError}</p> : null}
            <ProjectSessionList projectId={project.id} sessions={sessions} />
          </section>
        </section>
      </ScrollableLayout>
    </>
  );
}
