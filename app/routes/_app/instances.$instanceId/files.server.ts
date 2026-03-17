import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { browseInstanceFiles, readInstanceFile } from "~/lib/instances/files.server";
import { getInstanceOrThrow } from "~/lib/instances/runtime.server";

export async function loadInstanceFilesRouteData({
  instanceId,
  request,
}: {
  instanceId: string;
  request: Request;
}) {
  await requireAuthenticatedPasskey(request);

  const instance = await getInstanceOrThrow(instanceId);
  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  const file = url.searchParams.get("file");
  const listing = browseInstanceFiles(path, instance.directory, "either");

  let selected = null;
  let selectedError: string | null = null;

  if (file) {
    try {
      selected = readInstanceFile(file, instance.directory);
    } catch (error) {
      selectedError = error instanceof Response ? await error.text() : "Failed to read file.";
    }
  }

  return {
    instance,
    listing,
    selected,
    selectedError,
    selectedPath: file,
  };
}
