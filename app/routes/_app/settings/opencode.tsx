import { data, useFetcher } from "react-router";

import { Breadcrumbs } from "~/components/shell/breadcrumbs";
import { ScrollableLayout } from "~/components/shell/scrollable-layout";
import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { getDocumentTitle } from "~/lib/document-title";
import {
  getSharedOpencodeRuntimeStatus,
  restartSharedOpencodeServer,
  startSharedOpencodeServer,
  updateSharedOpencodeServer,
} from "~/lib/opencode/shared-runtime.server";
import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleDefinition } from "~/lib/route-handle";

import type { Route } from "./+types/opencode";

function formatRuntimeDuration(activeSince: number, now = Date.now()) {
  const elapsedMs = Math.max(0, now - activeSince);
  const minutes = Math.floor(elapsedMs / 60_000);

  if (minutes < 1) {
    return "less than a minute";
  }

  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  const days = Math.floor(hours / 24);

  return `${days} day${days === 1 ? "" : "s"}`;
}

export const handle: RouteHandleDefinition<Route.ComponentProps> = defineRouteHandle<Route.ComponentProps>({
  iconNavActions: [
    {
      icon: "mdi:arrow-left",
      label: "Back to settings",
      to: "/settings",
      end: true,
    },
  ],
});

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuthenticatedPasskey(request);

  return {
    runtime: await getSharedOpencodeRuntimeStatus(),
  };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuthenticatedPasskey(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "").trim();

  if (intent !== "restart" && intent !== "update") {
    return data({ error: "That action is not supported.", message: null, ok: false }, { status: 400 });
  }

  const runtime = await getSharedOpencodeRuntimeStatus();

  if (runtime.mode === "external") {
    return data({ error: "OpenCode is managed externally.", message: null, ok: false }, { status: 409 });
  }

  try {
    if (intent === "update") {
      if (!runtime.isRunning) {
        return data({ error: "Start OpenCode before updating it.", message: null, ok: false }, { status: 409 });
      }

      const version = await updateSharedOpencodeServer();

      return data({
        error: null,
        message: `Successfully updated to OpenCode ${version}. Restart OpenCode to apply it.`,
        ok: true,
      });
    }

    if (!runtime.isRunning) {
      // Keep one primary runtime action in the UI: when nothing is running,
      // the restart flow becomes an explicit start.
      await startSharedOpencodeServer();
      return data({ error: null, message: null, ok: true });
    }

    await restartSharedOpencodeServer();
    return data({ error: null, message: null, ok: true });
  } catch (error) {
    return data(
      {
        error: error instanceof Error
          ? error.message
          : intent === "update"
            ? "Failed to update OpenCode."
            : "Failed to restart OpenCode.",
        message: null,
        ok: false,
      },
      { status: 500 },
    );
  }
}

export default function SettingsOpencodeRoute({ loaderData, matches }: Route.ComponentProps) {
  const fetcher = useFetcher<typeof action>();
  const isSubmitting = fetcher.state !== "idle";
  const intent = String(fetcher.formData?.get("intent") || "");
  const runtime = loaderData.runtime;
  const isExternal = runtime.mode === "external";
  const isRestarting = isSubmitting && intent === "restart";
  const isUpdating = isSubmitting && intent === "update";
  const restartLabel = isExternal
    ? "Restart OpenCode"
    : runtime.isRunning
      ? (isRestarting ? "Restarting OpenCode" : "Restart OpenCode")
      : (isRestarting ? "Starting OpenCode" : "Start OpenCode");
  const updateLabel = isUpdating ? "Updating OpenCode" : "Update OpenCode";
  const runningVersion = runtime.runningVersion ? <code>{runtime.runningVersion}</code> : (runtime.isRunning ? "Unavailable" : "Stopped");
  const installedVersion = runtime.installedVersion ? <code>{runtime.installedVersion}</code> : "Unavailable";

  return (
    <>
      <title>{getDocumentTitle("OpenCode", "Settings")}</title>
      <Breadcrumbs depth={matches.length}>
        <Breadcrumbs.Item to="/settings">Settings</Breadcrumbs.Item>
        <Breadcrumbs.Item>OpenCode</Breadcrumbs.Item>
      </Breadcrumbs>
      <ScrollableLayout>
        <section className="space-y-6 pt-6">
          <section>
            <div className="space-y-4 px-6 py-4 sm:px-8">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.08em]">Status</p>
                <p className="text-base leading-6">
                  Running version {runningVersion}
                  {runtime.activeSince ? <> (active for {formatRuntimeDuration(runtime.activeSince)})</> : null}
                </p>
                {isExternal ? null : <p className="text-base leading-6">Installed version {installedVersion}</p>}
                {runtime.restartRequired && runtime.installedVersion ? (
                  <p className="text-base leading-6">Restart required to apply installed OpenCode <code>{runtime.installedVersion}</code>.</p>
                ) : null}
              </div>
              {runtime.error ? <p className="text-base leading-6">{runtime.error}</p> : null}
              {isExternal ? (
                <p className="text-sm uppercase tracking-[0.08em]">External server</p>
              ) : null}
              {isExternal ? (
                <p className="text-base leading-6">
                  Scriptorium is configured to use <code>{runtime.serverUrl}</code>. Restart it where that server is hosted.
                </p>
              ) : null}
              {isExternal ? null : (
                <fetcher.Form className="flex flex-wrap gap-3" method="post">
                  <button
                    className="min-h-11 border-2 border-black px-3 py-2 text-base disabled:opacity-25"
                    disabled={isSubmitting || !runtime.isRunning}
                    name="intent"
                    type="submit"
                    value="update"
                  >
                    {updateLabel}
                  </button>
                  <button
                    className="min-h-11 bg-black px-3 py-2 text-base text-white disabled:opacity-25"
                    disabled={isSubmitting}
                    name="intent"
                    type="submit"
                    value="restart"
                  >
                    {restartLabel}
                  </button>
                </fetcher.Form>
              )}
              {isExternal ? null : (
                <p className="text-base leading-6 italic">
                  Update installs the latest OpenCode version. Start or restart applies the installed version to
                  Scriptorium&apos;s shared runtime.
                </p>
              )}
              {fetcher.data?.error ? <p className="text-base leading-6">{fetcher.data.error}</p> : null}
              {fetcher.data?.message ? <p className="text-base leading-6">{fetcher.data.message}</p> : null}
            </div>
          </section>
        </section>
      </ScrollableLayout>
    </>
  );
}
