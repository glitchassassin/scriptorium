import { GitBrowser } from "~/components/workspace/git-browser";
import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleDefinition } from "~/lib/route-handle";

import { getInstanceBreadcrumbs } from "./+/instance-route";
import { loadInstanceGitRouteData } from "./git.server";

import type { Route } from "./+types/git";

export const handle: RouteHandleDefinition<Route.ComponentProps> = defineRouteHandle<Route.ComponentProps>({
  title: ({ data, params }) => [
    ...getInstanceBreadcrumbs(data?.instance?.name, params.instanceId),
    { label: "git" },
  ],
});

export async function loader({ params, request }: Route.LoaderArgs) {
  const instanceId = params.instanceId;

  return loadInstanceGitRouteData({ instanceId, request });
}

export default function InstanceGitRoute({ loaderData }: Route.ComponentProps) {
  const { changed, git, instance, selected, selectedError, selectedPath } = loaderData;

  return (
    <GitBrowser
      changed={changed}
      git={git}
      rootPath={instance.directory}
      selected={selected}
      selectedError={selectedError}
      selectedPath={selectedPath}
    />
  );
}
