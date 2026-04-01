import { useOutletContext } from "react-router";

import { Breadcrumbs } from "~/components/shell/breadcrumbs";
import { ReviewBrowser } from "~/components/workspace/review-browser";
import { getDocumentTitle } from "~/lib/document-title";
import type { SessionReviewMode } from "~/lib/review";
import { getSessionReviewModeOptions } from "~/lib/review";
import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleDefinition } from "~/lib/route-handle";
import { useSessionInfo } from "~/routes/_app/projects.$projectId/sessions.$sessionId/+/session-live";
import {
  getServerTimingHeaders,
  loadSessionReviewRouteData,
} from "~/routes/_app/projects.$projectId/review.server";

import { getSessionIconNavActions, getSessionName, type SessionRouteContext } from "./+/session-route";

import type { Route } from "./+types/review.$mode";

function getMode(mode: string | undefined): SessionReviewMode {
  return mode === "session" || mode === "recent" || mode === "uncommitted" ? mode : "uncommitted";
}

export const handle: RouteHandleDefinition<Route.ComponentProps> = defineRouteHandle<Route.ComponentProps>({
  iconNavActions: ({ params }) => getSessionIconNavActions(params.projectId ?? "", params.sessionId ?? "", getMode(params.mode)),
});

export async function loader({ params, request }: Route.LoaderArgs) {
  return loadSessionReviewRouteData({
    projectId: params.projectId,
    mode: params.mode,
    request,
    sessionId: params.sessionId,
  });
}

export function headers(args: Route.HeadersArgs) {
  return getServerTimingHeaders(args);
}

export default function SessionReviewRoute({ loaderData, matches }: Route.ComponentProps) {
  const { insertComposerReference } = useOutletContext<SessionRouteContext>();
  const { project, mode, review, selected, selectedError, selectedPath } = loaderData;
  const session = useSessionInfo();

  return (
    <>
      <title>{getDocumentTitle("review", getSessionName(session))}</title>
      <Breadcrumbs depth={matches.length}>
        <Breadcrumbs.Item to={`/projects/${project.id}`}>{project.name}</Breadcrumbs.Item>
        <Breadcrumbs.Item to={`/projects/${project.id}/sessions/${session.id}`}>
          {getSessionName(session)}
        </Breadcrumbs.Item>
        <Breadcrumbs.Item>review</Breadcrumbs.Item>
      </Breadcrumbs>
      <ReviewBrowser
        mode={mode}
        modes={getSessionReviewModeOptions()}
        onInsertReference={insertComposerReference}
        review={review}
        selected={selected}
        selectedError={selectedError}
        selectedPath={selectedPath}
        switchBasePath={`/projects/${project.id}/sessions/${session.id}/review`}
      />
    </>
  );
}
