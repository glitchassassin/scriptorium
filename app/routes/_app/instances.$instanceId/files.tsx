import { FilesBrowser } from "~/components/workspace/files-browser";
import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleDefinition } from "~/lib/route-handle";

import { getInstanceBreadcrumbs } from "./+/instance-route";
import { loadInstanceFilesRouteData } from "./files.server";

import type { Route } from "./+types/files";

export const handle: RouteHandleDefinition<Route.ComponentProps> = defineRouteHandle<Route.ComponentProps>({
  title: ({ data, params }) => [
    ...getInstanceBreadcrumbs(data?.instance?.name, params.instanceId),
    { label: "files" },
  ],
});

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
