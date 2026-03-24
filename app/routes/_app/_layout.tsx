import type { Route } from "./+types/_layout";

import { InstanceEventsProvider } from "~/components/events/instance-events-provider";
import { ReadStatusEventsProvider } from "~/components/events/read-status-events-provider";
import { useBrowserResumeRevalidation } from "~/components/events/use-browser-resume-revalidation";
import { BreadcrumbsProvider, useBreadcrumbs } from "~/components/shell/breadcrumbs";
import { getInitialInstances, InstancesProvider } from "~/store/instances-provider";
import { SessionsProvider } from "~/store/sessions-provider";
import { AppShell } from "~/components/shell/app-shell";
import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { listRecentSidebarSessions } from "~/lib/instances/opencode.server";
import { listInstances } from "~/lib/instances/runtime.server";
import { sortSidebarInstances, withSessionReadState } from "~/lib/instances/sidebar";
import { normalizeRouteHandleMatches, resolveRouteHandleValue, type RouteHandleIconAction } from "~/lib/route-handle";
import { listSessionReadStatuses } from "~/lib/session-read-status.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuthenticatedPasskey(request);
  const instances = await listInstances();
  const readStatuses = listSessionReadStatuses();
  const readStatusMap = new Map(
    readStatuses.map((status) => [status.sessionId, status.lastReadAt]),
  );
  const sidebarInstances = sortSidebarInstances(await Promise.all(instances.map(async (instance) => {
    try {
      return {
        id: instance.id,
        name: instance.name,
        status: instance.status,
        recentSessions: (await listRecentSidebarSessions(instance)).map((session) =>
          withSessionReadState(session, readStatusMap.get(session.id) ?? null),
        ),
      };
    } catch {
      return {
        id: instance.id,
        name: instance.name,
        status: instance.status,
        recentSessions: [],
      };
    }
  })));
  const initialSessions = Object.fromEntries(
    sidebarInstances.flatMap((instance) =>
      instance.recentSessions.map((session) => [
        session.id,
        session,
      ] as const),
    ),
  );
  const initialInstances = getInitialInstances(sidebarInstances);

  return {
    liveInstanceIds: instances
      .filter((instance) => instance.status === "starting" || instance.status === "running")
      .map((instance) => instance.id),
    initialInstances,
    initialSessions,
  };
}

function AppLayoutShell({
  breadcrumbsFallback,
  iconNavActions,
  leadingIconAction,
}: {
  breadcrumbsFallback: { content: string }[];
  iconNavActions: RouteHandleIconAction[];
  leadingIconAction?: RouteHandleIconAction;
}) {
  const breadcrumbs = useBreadcrumbs();

  return (
    <AppShell
      breadcrumbs={breadcrumbs.length ? breadcrumbs : breadcrumbsFallback}
      leadingIconAction={leadingIconAction}
      iconNavActions={iconNavActions ?? []}
    />
  );
}

export default function AppLayout({ loaderData, matches }: Route.ComponentProps) {
  useBrowserResumeRevalidation();
  const routeMatches = normalizeRouteHandleMatches(matches);
  const leadingIconAction = resolveRouteHandleValue(routeMatches, "leadingIconAction");
  const iconNavActions = resolveRouteHandleValue(routeMatches, "iconNavActions") ?? [];

  return (
    <InstanceEventsProvider instanceIds={loaderData.liveInstanceIds}>
      <ReadStatusEventsProvider>
        <SessionsProvider initialSessions={loaderData.initialSessions}>
          <InstancesProvider initialInstances={loaderData.initialInstances}>
            <BreadcrumbsProvider>
              <AppLayoutShell
                breadcrumbsFallback={[{ content: "Scriptorium" }]}
                leadingIconAction={leadingIconAction}
                iconNavActions={iconNavActions}
              />
            </BreadcrumbsProvider>
          </InstancesProvider>
        </SessionsProvider>
      </ReadStatusEventsProvider>
    </InstanceEventsProvider>
  );
}
