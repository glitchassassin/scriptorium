import { useOutletContext } from "react-router";

import { GitBrowser } from "~/components/workspace/git-browser";
import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleDefinition } from "~/lib/route-handle";
import { loadInstanceGitRouteData } from "~/routes/_app/instances.$instanceId/git.server";

import { getSessionBreadcrumbs, type SessionRouteContext } from "./+/session-route";

import type { Route } from "./+types/git";

export const handle: RouteHandleDefinition<Route.ComponentProps> = defineRouteHandle<Route.ComponentProps>({
  title: (ctx) => {
    const sessionMatch = ctx.requireMatch("routes/_app/instances.$instanceId/sessions.$sessionId/_layout");

    return [
      ...getSessionBreadcrumbs({
        instanceId: sessionMatch.params.instanceId,
        instanceName: sessionMatch.data.instance?.name,
        session: sessionMatch.data.session,
        sessionId: sessionMatch.params.sessionId,
      }),
      { label: "git" },
    ];
  },
});

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
