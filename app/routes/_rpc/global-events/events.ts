import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { createGlobalEventsResponse } from "~/lib/global-events.server";

import type { Route } from "./+types/events";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuthenticatedPasskey(request);
  return createGlobalEventsResponse(request);
}
