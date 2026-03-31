import { data } from "react-router";

import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { resolveProjectFileReferences } from "~/lib/projects/files.server";
import { getProjectOrThrow } from "~/lib/projects/runtime.server";

type ResolveFileReferencesLoaderData = {
  results: Record<string, { path: string } | null>;
};

export async function loader({ params, request }: { params: { projectId: string }; request: Request }) {
  await requireAuthenticatedPasskey(request);

  const project = await getProjectOrThrow(params.projectId);
  const url = new URL(request.url);
  const lookupPaths = Array.from(new Set(url.searchParams.getAll("candidate")));

  return data<ResolveFileReferencesLoaderData>({
    results: resolveProjectFileReferences(lookupPaths, project.directory),
  });
}
