import { useOutletContext } from "react-router";

import { Breadcrumbs } from "~/components/shell/breadcrumbs";
import { FilesBrowser } from "~/components/workspace/files-browser";
import { getDocumentTitle } from "~/lib/document-title";
import { getServerTimingHeaders } from "~/lib/server-timing.server";
import { useSessionInfo } from "~/routes/_app/projects.$projectId/sessions.$sessionId/+/session-live";
import { loadProjectFilesRouteData } from "~/routes/_app/projects.$projectId/files.server";

import { getSessionName, type SessionRouteContext } from "./+/session-route";

import type { Route } from "./+types/files";

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
      <title>{getDocumentTitle("files", getSessionName(session))}</title>
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
