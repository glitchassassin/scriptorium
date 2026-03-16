import type { Route } from "./+types/_layout";

import { InstanceEventsProvider } from "~/components/events/instance-events-provider";
import { AppShell } from "~/components/shell/app-shell";
import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { listRecentSidebarSessions } from "~/lib/instances/opencode.server";
import { listInstances } from "~/lib/instances/runtime.server";
import { sortSidebarInstances } from "~/lib/instances/sidebar";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuthenticatedPasskey(request);
  const instances = await listInstances();
  const sidebarInstances = sortSidebarInstances(await Promise.all(instances.map(async (instance) => {
    try {
      return {
        id: instance.id,
        name: instance.name,
        status: instance.status,
        recentSessions: await listRecentSidebarSessions(instance),
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

  return {
    liveInstanceIds: instances
      .filter((instance) => instance.status === "starting" || instance.status === "running")
      .map((instance) => instance.id),
    sidebarInstances,
  };
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  return (
    <InstanceEventsProvider instanceIds={loaderData.liveInstanceIds}>
      <AppShell sidebarInstances={loaderData.sidebarInstances} />
    </InstanceEventsProvider>
  );
}
