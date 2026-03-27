import { useEffect, useMemo, useState } from "react";
import { data, Form, redirect } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import { useInstanceEvents } from "~/components/events/instance-events-provider";
import { Breadcrumbs } from "~/components/shell/breadcrumbs";
import { ScrollableLayout } from "~/components/shell/scrollable-layout";
import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { getGitStatusSummary } from "~/lib/instances/git.server";
import { createOpencodeSession, listOpencodeSessions } from "~/lib/instances/opencode.server";
import { sortSessions, toSessionSummary } from "~/lib/instances/sidebar";
import { getInstanceOrThrow, removeInstance } from "~/lib/instances/runtime.server";
import type { OpencodeSessionSummary } from "~/lib/instances/types";
import { opencodeSessionMutationEventSchema } from "~/lib/opencode/events";
import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleDefinition } from "~/lib/route-handle";
import { getServerTimingHeaders, makeTimings, time } from "~/lib/server-timing.server";

import { getInstanceBreadcrumbs } from "./+/instance-route";
import { InstanceSessionList } from "./+/instance-session-list";

import type { Route } from "./+types/index";

export const handle: RouteHandleDefinition<Route.ComponentProps> = defineRouteHandle<Route.ComponentProps>({
  title: (ctx) => getInstanceBreadcrumbs(ctx.data.instance.name, ctx.params.instanceId),
});

export async function loader({ params, request }: Route.LoaderArgs) {
  const timings = makeTimings("instance loader");

  await time(() => requireAuthenticatedPasskey(request), {
    desc: "require authenticated passkey",
    timings,
    type: "auth",
  });

  const instance = await time(() => getInstanceOrThrow(params.instanceId), {
    desc: "get instance",
    timings,
    type: "instance",
  });
  const git = await time(() => getGitStatusSummary(instance.directory), {
    desc: "get git summary",
    timings,
    type: "git",
  });

  try {
    const sessions = await time(() => listOpencodeSessions(instance), {
      desc: "list recent sessions",
      timings,
      type: "sessions",
    });

    return data(
      {
        git,
        instance,
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
        instance,
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
    const instance = await getInstanceOrThrow(params.instanceId);
    const session = await createOpencodeSession(instance);
    return redirect(`/instances/${params.instanceId}/sessions/${session.id}`);
  }

  await removeInstance(params.instanceId);

  return redirect("/instances");
}

function InstanceOverviewHeader({
  directory,
  git,
  status,
}: {
  directory: string;
  git: Route.ComponentProps["loaderData"]["git"];
  status: string;
}) {
  return (
    <div className="grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <div className="flex min-w-0 items-baseline gap-3">
        <p className="truncate text-base font-bold">{directory}</p>
        <p className="shrink-0 text-sm leading-6 opacity-60">{status}</p>
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

export default function InstanceDetailRoute({ loaderData, matches }: Route.ComponentProps) {
  const { git, instance, recentSessions, sessionError } = loaderData;
  const [sessions, setSessions] = useState<OpencodeSessionSummary[]>(() => sortSessions(recentSessions));
  const sessionEventTypes = useMemo(
    () => ["session.created", "session.updated", "session.deleted"] as const,
    [],
  );

  useEffect(() => {
    setSessions(sortSessions(recentSessions));
  }, [recentSessions, instance.id]);

  useInstanceEvents(
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
    { instanceId: instance.id, types: sessionEventTypes },
  );

  return (
    <>
      <Breadcrumbs depth={matches.length}>
        <Breadcrumbs.Item to={`/instances/${instance.id}`}>{instance.name}</Breadcrumbs.Item>
      </Breadcrumbs>
      <ScrollableLayout
        header={<InstanceOverviewHeader directory={instance.directory} git={git} status={instance.status} />}
        footer={
          <Form method="post">
            <button className="min-h-11 bg-black px-3 py-2 text-base text-white" type="submit">
              Remove instance
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
            <InstanceSessionList instanceId={instance.id} sessions={sessions} />
          </section>
        </section>
      </ScrollableLayout>
    </>
  );
}
