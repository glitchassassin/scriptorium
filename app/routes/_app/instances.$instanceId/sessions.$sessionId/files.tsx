import { useOutletContext } from "react-router";

import { FilesBrowser } from "~/components/workspace/files-browser";
import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleDefinition } from "~/lib/route-handle";
import { loadInstanceFilesRouteData } from "~/routes/_app/instances.$instanceId/files.server";

import { getSessionBreadcrumbs, type SessionRouteContext } from "./+/session-route";

import type { Route } from "./+types/files";

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
      { label: "files" },
    ];
  },
});

export async function loader({ params, request }: Route.LoaderArgs) {
  const instanceId = params.instanceId;

  return loadInstanceFilesRouteData({ instanceId, request });
}

export default function SessionFilesRoute({ loaderData }: Route.ComponentProps) {
  const { insertComposerReference } = useOutletContext<SessionRouteContext>();
  const { instance, listing, selected, selectedError, selectedPath } = loaderData;

  return (
    <FilesBrowser
      listing={listing}
      onInsertReference={insertComposerReference}
      rootPath={instance.directory}
      selected={selected}
      selectedError={selectedError}
      selectedPath={selectedPath}
    />
  );
}
