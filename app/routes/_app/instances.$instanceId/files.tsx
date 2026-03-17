import { FilesBrowser } from "~/components/workspace/files-browser";
import type { RouteHandle } from "~/lib/route-handle";

import { getInstanceBreadcrumbs } from "./+/instance-route";
import { loadInstanceFilesRouteData } from "./files.server";

import type { Route } from "./+types/files";

export const handle = {
  title: ({ data, params }: { data?: unknown; params: Record<string, string | undefined> }) => [
    ...getInstanceBreadcrumbs(data, params["instanceId"]),
    { label: "files" },
  ],
} satisfies RouteHandle;

export async function loader({ params, request }: Route.LoaderArgs) {
  const instanceId = params.instanceId;

  return loadInstanceFilesRouteData({ instanceId, request });
}

export default function InstanceFilesRoute({ loaderData }: Route.ComponentProps) {
  const { instance, listing, selected, selectedError, selectedPath } = loaderData;

  return (
    <FilesBrowser
      listing={listing}
      rootPath={instance.directory}
      selected={selected}
      selectedError={selectedError}
      selectedPath={selectedPath}
    />
  );
}
