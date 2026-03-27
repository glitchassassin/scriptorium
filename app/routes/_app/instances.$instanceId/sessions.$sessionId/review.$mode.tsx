import { useOutletContext } from "react-router";

import { Breadcrumbs } from "~/components/shell/breadcrumbs";
import { ReviewBrowser } from "~/components/workspace/review-browser";
import type { SessionReviewMode } from "~/lib/review";
import { getSessionReviewModeOptions } from "~/lib/review";
import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleDefinition } from "~/lib/route-handle";
import { useSessionInfo } from "~/routes/_app/instances.$instanceId/sessions.$sessionId/+/session-live";
import {
  getServerTimingHeaders,
  loadSessionReviewRouteData,
} from "~/routes/_app/instances.$instanceId/review.server";

import { getSessionBreadcrumbs, getSessionIconNavActions, getSessionName, type SessionRouteContext } from "./+/session-route";

import type { Route } from "./+types/review.$mode";

function getMode(mode: string | undefined): SessionReviewMode {
  return mode === "session" || mode === "recent" || mode === "uncommitted" ? mode : "uncommitted";
}

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
      { label: "review" },
    ];
  },
  iconNavActions: ({ params }) => getSessionIconNavActions(params.instanceId ?? "", params.sessionId ?? "", getMode(params.mode)),
});

export async function loader({ params, request }: Route.LoaderArgs) {
  return loadSessionReviewRouteData({
    instanceId: params.instanceId,
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
  const { instance, mode, review, selected, selectedError, selectedPath } = loaderData;
  const session = useSessionInfo();

  return (
    <>
      <Breadcrumbs depth={matches.length}>
        <Breadcrumbs.Item to={`/instances/${instance.id}`}>{instance.name}</Breadcrumbs.Item>
        <Breadcrumbs.Item to={`/instances/${instance.id}/sessions/${session.id}`}>
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
        switchBasePath={`/instances/${instance.id}/sessions/${session.id}/review`}
      />
    </>
  );
}
