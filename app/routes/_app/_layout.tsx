import type { Route } from "./+types/_layout";

import { InstanceEventsProvider } from "~/components/events/instance-events-provider";
import { AppShell } from "~/components/shell/app-shell";
import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { listInstances } from "~/lib/instances/runtime.server";

export async function loader({ request }: Route.LoaderArgs) {
  const { passkey } = await requireAuthenticatedPasskey(request);
  const instances = await listInstances();

  return {
    liveInstanceIds: instances
      .filter((instance) => instance.status === "starting" || instance.status === "running")
      .map((instance) => instance.id),
    passkeyLabel: passkey?.label || "Localhost",
  };
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  return (
    <InstanceEventsProvider instanceIds={loaderData.liveInstanceIds}>
      <AppShell passkeyLabel={loaderData.passkeyLabel} />
    </InstanceEventsProvider>
  );
}
