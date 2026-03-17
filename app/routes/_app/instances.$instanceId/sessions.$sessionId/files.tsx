import type { RouteHandle } from "~/lib/route-handle";
import InstanceFilesRoute from "~/routes/_app/instances.$instanceId/files";
import { loadInstanceFilesRouteData } from "~/routes/_app/instances.$instanceId/files.server";

import { sessionRouteTitle } from "./+/session-route";

import type { Route } from "./+types/files";

export const handle = {
  title: ({ data }: { data?: unknown }) => `${sessionRouteTitle(data)} / files`,
} satisfies RouteHandle;

export async function loader({ params, request }: Route.LoaderArgs) {
  const instanceId = params.instanceId;

  return loadInstanceFilesRouteData({ instanceId, request });
}

export default InstanceFilesRoute;
