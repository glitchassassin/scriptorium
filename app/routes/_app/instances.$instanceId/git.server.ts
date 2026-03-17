import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { getGitChangedFiles, getGitFileDiff, getGitStatusSummary } from "~/lib/instances/git.server";
import { getInstanceOrThrow } from "~/lib/instances/runtime.server";

export async function loadInstanceGitRouteData({
  instanceId,
  request,
}: {
  instanceId: string;
  request: Request;
}) {
  await requireAuthenticatedPasskey(request);

  const instance = await getInstanceOrThrow(instanceId);
  const git = getGitStatusSummary(instance.directory);
  const changed = getGitChangedFiles(instance.directory);
  const url = new URL(request.url);
  const path = url.searchParams.get("path");

  let selected = null;
  let selectedError: string | null = null;

  if (path && changed.isRepository) {
    try {
      const result = getGitFileDiff(instance.directory, path);
      selected = result.isRepository ? result : null;
    } catch (error) {
      selectedError = error instanceof Response ? await error.text() : "Failed to load file diff.";
    }
  }

  return {
    changed,
    git,
    instance,
    selected,
    selectedError,
    selectedPath: path,
  };
}
