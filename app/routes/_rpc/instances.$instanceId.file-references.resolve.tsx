import { data } from "react-router";

import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { resolveInstanceFileReferences } from "~/lib/instances/files.server";
import { getInstanceOrThrow } from "~/lib/instances/runtime.server";

type ResolveFileReferencesLoaderData = {
  results: Record<string, { path: string } | null>;
};

export async function loader({ params, request }: { params: { instanceId: string }; request: Request }) {
  await requireAuthenticatedPasskey(request);

  const instance = await getInstanceOrThrow(params.instanceId);
  const url = new URL(request.url);
  const lookupPaths = Array.from(new Set(url.searchParams.getAll("candidate")));

  return data<ResolveFileReferencesLoaderData>({
    results: resolveInstanceFileReferences(lookupPaths, instance.directory),
  });
}
