import { GitBrowser } from "~/components/workspace/git-browser";
import { Breadcrumbs } from "~/components/shell/breadcrumbs";
import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleDefinition } from "~/lib/route-handle";
import { getServerTimingHeaders } from "~/lib/server-timing.server";

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

export function headers(args: Route.HeadersArgs) {
  return getServerTimingHeaders(args);
}

export default function InstanceGitRoute({ loaderData, matches }: Route.ComponentProps) {
  const { changed, git, instance, selected, selectedError, selectedPath } = loaderData;

  return (
    <>
      <Breadcrumbs depth={matches.length}>
        <Breadcrumbs.Item to={`/instances/${instance.id}`}>{instance.name}</Breadcrumbs.Item>
        <Breadcrumbs.Item>git</Breadcrumbs.Item>
      </Breadcrumbs>
      <GitBrowser
        changed={changed}
        git={git}
        rootPath={instance.directory}
        selected={selected}
        selectedError={selectedError}
        selectedPath={selectedPath}
      />
    </>
  );
}
