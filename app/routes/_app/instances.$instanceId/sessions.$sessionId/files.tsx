import { useOutletContext } from "react-router";

import { FilesBrowser } from "~/components/workspace/files-browser";
import type { RouteHandle } from "~/lib/route-handle";
import { loadInstanceFilesRouteData } from "~/routes/_app/instances.$instanceId/files.server";

import { getSessionBreadcrumbs, getSessionDataFromMatches, type SessionRouteContext } from "./+/session-route";

import type { Route } from "./+types/files";

export const handle = {
  title: ({ data, matches, params }) => [
    ...getSessionBreadcrumbs(
      getSessionDataFromMatches(matches) ?? data,
      params["instanceId"],
      params["sessionId"],
    ),
    { label: "files" },
  ],
} satisfies RouteHandle;

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
