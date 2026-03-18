import type { Route } from "./+types/_layout";

import { InstanceEventsProvider } from "~/components/events/instance-events-provider";
import { ReadStatusEventsProvider } from "~/components/events/read-status-events-provider";
import { getInitialInstances, InstancesProvider } from "~/store/instances-provider";
import { SessionsProvider } from "~/store/sessions-provider";
import { AppShell } from "~/components/shell/app-shell";
import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { listRecentSidebarSessions } from "~/lib/instances/opencode.server";
import { listInstances } from "~/lib/instances/runtime.server";
import { sortSidebarInstances, withSessionReadState } from "~/lib/instances/sidebar";
import { normalizeRouteHandleMatches, resolveRouteHandleValue } from "~/lib/route-handle";
import { listSessionReadStatuses } from "~/lib/session-read-status.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuthenticatedPasskey(request);
  const instances = await listInstances();
  const readStatuses = listSessionReadStatuses();
  const readStatusMap = new Map(
    readStatuses.map((status) => [`${status.instanceId}:${status.sessionId}`, status.lastReadAt]),
  );
  const sidebarInstances = sortSidebarInstances(await Promise.all(instances.map(async (instance) => {
    try {
      return {
        id: instance.id,
        name: instance.name,
        status: instance.status,
        recentSessions: (await listRecentSidebarSessions(instance)).map((session) =>
          withSessionReadState(session, readStatusMap.get(`${instance.id}:${session.id}`) ?? null),
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

export default function AppLayout({ loaderData, matches }: Route.ComponentProps) {
  const routeMatches = normalizeRouteHandleMatches(matches);
  const breadcrumbs = resolveRouteHandleValue(routeMatches, "title") ?? [{ label: "Scriptorium" }];
  const iconNavActions = resolveRouteHandleValue(routeMatches, "iconNavActions") ?? [];

  return (
    <InstanceEventsProvider instanceIds={loaderData.liveInstanceIds}>
      <ReadStatusEventsProvider>
        <SessionsProvider initialSessions={loaderData.initialSessions}>
          <InstancesProvider initialInstances={loaderData.initialInstances}>
            <AppShell
              breadcrumbs={breadcrumbs}
              iconNavActions={iconNavActions}
            />
          </InstancesProvider>
        </SessionsProvider>
      </ReadStatusEventsProvider>
    </InstanceEventsProvider>
  );
}
