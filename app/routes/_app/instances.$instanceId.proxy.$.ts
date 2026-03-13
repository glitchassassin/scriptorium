import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { proxyInstanceRequest } from "~/lib/instances/proxy.server";

import type { Route } from "./+types/instances.$instanceId.proxy.$";

async function handleProxy({ params, request }: Route.LoaderArgs | Route.ActionArgs) {
  await requireAuthenticatedPasskey(request);
  return proxyInstanceRequest(request, params.instanceId, params["*"]);
}

export async function loader(args: Route.LoaderArgs) {
  return handleProxy(args);
}

export async function action(args: Route.ActionArgs) {
  return handleProxy(args);
}
