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
    return instance?.name ? `Instance / ${instance.name}` : "Instance";
  },
  iconNavActions: [
    {
      icon: "mdi:arrow-left",
      label: "Back to instances",
      to: "/instances",
      end: true,
    },
  ],
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

export default function InstanceDetailRoute({ loaderData }: Route.ComponentProps) {
  const { git, instance, recentSessions, sessionError } = loaderData;

  return (
    <ScrollableLayout
      footer={
        <Form method="post">
          <button className="min-h-11 bg-black px-3 py-2 text-base text-white" type="submit">
            Remove instance
          </button>
        </Form>
      }
    >
      <section className="space-y-8 pr-1">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="text-xl font-bold break-all">{instance.directory}</p>
              <p className="text-sm leading-6 opacity-60">{instance.status}</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-6 opacity-60">
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
        </div>

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
