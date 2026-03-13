import { Form, redirect } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import { ScrollableLayout } from "~/components/shell/scrollable-layout";
import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { getGitStatusSummary } from "~/lib/instances/git.server";
import { listOpencodeSessions } from "~/lib/instances/opencode.server";
import { getInstanceOrThrow, removeInstance } from "~/lib/instances/runtime.server";
import type { OpencodeSessionSummary } from "~/lib/instances/types";
import type { RouteHandle } from "~/lib/route-handle";

import type { Route } from "./+types/instances.$instanceId";

export const handle = {
  title: ({ data }: { data?: unknown }) => {
    const instance = (data as { instance?: { name?: string } } | undefined)?.instance;
    return instance?.name ?? "Instance";
  },
  iconNavActions: ({ params }: { params: Record<string, string | undefined> }) => {
    const instanceId = params["instanceId"] ?? "";

    return [
      {
        icon: "mdi:view-dashboard-outline",
        label: "Instance overview",
        to: `/instances/${instanceId}`,
        end: true,
      },
      {
        icon: "mdi:source-branch",
        label: "Git view",
        to: `/instances/${instanceId}/git`,
        end: true,
      },
      {
        icon: "mdi:file-document-multiple-outline",
        label: "Files view",
        to: `/instances/${instanceId}/files`,
        end: true,
      },
    ];
  },
} satisfies RouteHandle;

export async function loader({ params, request }: Route.LoaderArgs) {
  await requireAuthenticatedPasskey(request);

  const instance = await getInstanceOrThrow(params.instanceId);
  const git = getGitStatusSummary(instance.directory);

  try {
    const sessions = await listOpencodeSessions(instance);

    return {
      git,
      instance,
      recentSessions: sessions,
      sessionError: null,
    };
  } catch (error) {
    return {
      git,
      instance,
      recentSessions: [],
      sessionError: error instanceof Error ? error.message : "Failed to load sessions.",
    };
  }
}

export async function action({ params, request }: Route.ActionArgs) {
  await requireAuthenticatedPasskey(request);

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

export default function InstanceDetailRoute({ loaderData }: Route.ComponentProps) {
  const { git, instance, recentSessions, sessionError } = loaderData;

  return (
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
      <section className="space-y-8 pr-1">
        <section className="space-y-3">
          <p className="text-sm uppercase tracking-[0.08em]">Recent sessions</p>
          {sessionError ? <p className="text-base leading-6">{sessionError}</p> : null}
          {recentSessions.length ? (
            <ul className="border-t-2 border-black/50">
              {recentSessions.map((session: OpencodeSessionSummary) => (
                <li className="space-y-1 border-b-2 border-black/50 px-3 py-2" key={session.id}>
                  <p className="text-base font-bold">{session.title || session.id.slice(0, 12)}</p>
                  {session.updatedAt ? (
                    <p className="text-sm leading-6 opacity-60">
                      Updated {new Date(session.updatedAt).toLocaleString()}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base leading-6">No Opencode sessions were found for this instance.</p>
          )}
        </section>
      </section>
    </ScrollableLayout>
  );
}
