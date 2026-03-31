import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { proxyProjectRequest } from "~/lib/projects/proxy.server";

import type { Route } from "./+types/projects.$projectId.proxy.$";

async function handleProxy({ params, request }: Route.LoaderArgs | Route.ActionArgs) {
  await requireAuthenticatedPasskey(request);
  return proxyProjectRequest(request, params.projectId, params["*"]);
}

export async function loader(args: Route.LoaderArgs) {
  return handleProxy(args);
}

export async function action(args: Route.ActionArgs) {
  return handleProxy(args);
}
