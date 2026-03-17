import { useOutletContext } from "react-router";

import { GitBrowser } from "~/components/workspace/git-browser";
import type { RouteHandle } from "~/lib/route-handle";
import { loadInstanceGitRouteData } from "~/routes/_app/instances.$instanceId/git.server";

import { getSessionBreadcrumbs, getSessionDataFromMatches, type SessionRouteContext } from "./+/session-route";

import type { Route } from "./+types/git";

export const handle = {
  title: ({ data, matches, params }) => [
    ...getSessionBreadcrumbs(
      getSessionDataFromMatches(matches) ?? data,
      params["instanceId"],
      params["sessionId"],
    ),
    { label: "git" },
  ],
} satisfies RouteHandle;

export async function loader({ params, request }: Route.LoaderArgs) {
  const instanceId = params.instanceId;

  return loadInstanceGitRouteData({ instanceId, request });
}

export default function SessionGitRoute({ loaderData }: Route.ComponentProps) {
  const { insertComposerReference } = useOutletContext<SessionRouteContext>();
  const { changed, git, instance, selected, selectedError, selectedPath } = loaderData;

  return (
    <GitBrowser
      changed={changed}
      git={git}
      onInsertReference={insertComposerReference}
      rootPath={instance.directory}
      selected={selected}
      selectedError={selectedError}
      selectedPath={selectedPath}
    />
  );
}
