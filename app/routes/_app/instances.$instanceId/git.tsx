import { GitBrowser } from "~/components/workspace/git-browser";
import type { RouteHandle } from "~/lib/route-handle";

import { loadInstanceGitRouteData } from "./git.server";

import type { Route } from "./+types/git";

export const handle = {
  title: ({ data }: { data?: unknown }) => {
    const instance = (data as { instance?: { name?: string } } | undefined)?.instance;
    const title = instance?.name ?? "Instance";
    return title === "Instance" ? "Git" : `${title} / git`;
  },
} satisfies RouteHandle;

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
