import type { Route } from "./+types/_layout";

import { AppShell } from "~/components/shell/app-shell";
import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";

export async function loader({ request }: Route.LoaderArgs) {
  const { passkey } = await requireAuthenticatedPasskey(request);

  return {
    passkeyLabel: passkey?.label || "Localhost",
  };
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  return <AppShell passkeyLabel={loaderData.passkeyLabel} />;
}
