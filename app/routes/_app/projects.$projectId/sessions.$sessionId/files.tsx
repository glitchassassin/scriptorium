import { useOutletContext } from "react-router";

import { Breadcrumbs } from "~/components/shell/breadcrumbs";
import { FilesBrowser } from "~/components/workspace/files-browser";
import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleDefinition } from "~/lib/route-handle";
import { getServerTimingHeaders } from "~/lib/server-timing.server";
import { useSessionInfo } from "~/routes/_app/projects.$projectId/sessions.$sessionId/+/session-live";
import { loadProjectFilesRouteData } from "~/routes/_app/projects.$projectId/files.server";

import { getSessionBreadcrumbs, getSessionName, type SessionRouteContext } from "./+/session-route";

import type { Route } from "./+types/files";

export const handle: RouteHandleDefinition<Route.ComponentProps> = defineRouteHandle<Route.ComponentProps>({
  title: (ctx) => {
    const sessionMatch = ctx.requireMatch("routes/_app/projects.$projectId/sessions.$sessionId/_layout");

    return [
      ...getSessionBreadcrumbs({
        projectId: sessionMatch.params.projectId,
        projectName: sessionMatch.data.project?.name,
        session: sessionMatch.data.session,
        sessionId: sessionMatch.params.sessionId,
      }),
      { label: "files" },
    ];
  },
});

export async function loader({ params, request }: Route.LoaderArgs) {
  const projectId = params.projectId;

  return loadProjectFilesRouteData({ projectId, request });
}

export function headers(args: Route.HeadersArgs) {
  return getServerTimingHeaders(args);
}

export default function SessionFilesRoute({ loaderData, matches }: Route.ComponentProps) {
  const { insertComposerReference } = useOutletContext<SessionRouteContext>();
  const { project, listing, selected, selectedError, selectedLineRange, selectedPath } = loaderData;
  const session = useSessionInfo();

  return (
    <>
      <Breadcrumbs depth={matches.length}>
        <Breadcrumbs.Item to={`/projects/${project.id}`}>{project.name}</Breadcrumbs.Item>
        <Breadcrumbs.Item to={`/projects/${project.id}/sessions/${session.id}`}>
          {getSessionName(session)}
        </Breadcrumbs.Item>
        <Breadcrumbs.Item>files</Breadcrumbs.Item>
      </Breadcrumbs>
      <FilesBrowser
        listing={listing}
        onInsertReference={insertComposerReference}
        rootPath={project.directory}
        selected={selected}
        selectedError={selectedError}
        selectedLineRange={selectedLineRange}
        selectedPath={selectedPath}
      />
    </>
  );
}
