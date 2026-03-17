import type { RouteHandle } from "~/lib/route-handle";
import InstanceGitRoute from "~/routes/_app/instances.$instanceId/git";
import { loadInstanceGitRouteData } from "~/routes/_app/instances.$instanceId/git.server";

import { sessionRouteTitle } from "./+/session-route";

import type { Route } from "./+types/git";

export const handle = {
  title: ({ data }: { data?: unknown }) => `${sessionRouteTitle(data)} / git`,
} satisfies RouteHandle;

export async function loader({ params, request }: Route.LoaderArgs) {
  const instanceId = params.instanceId;

  return loadInstanceGitRouteData({ instanceId, request });
}

export default InstanceGitRoute;
