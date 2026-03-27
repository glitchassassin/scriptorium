import { Breadcrumbs } from "~/components/shell/breadcrumbs";
import { ReviewBrowser } from "~/components/workspace/review-browser";
import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleDefinition } from "~/lib/route-handle";
import { getServerTimingHeaders, loadInstanceUncommittedReviewRouteData } from "~/routes/_app/instances.$instanceId/review.server";

import { getInstanceBreadcrumbs } from "./+/instance-route";

import type { Route } from "./+types/review.uncommitted";

export const handle: RouteHandleDefinition<Route.ComponentProps> = defineRouteHandle<Route.ComponentProps>({
  title: ({ data, params }) => [
    ...getInstanceBreadcrumbs(data?.instance?.name, params.instanceId),
    { label: "review" },
  ],
});

export async function loader({ params, request }: Route.LoaderArgs) {
  return loadInstanceUncommittedReviewRouteData({
    instanceId: params.instanceId,
    request,
  });
}

export function headers(args: Route.HeadersArgs) {
  return getServerTimingHeaders(args);
}

export default function InstanceReviewRoute({ loaderData, matches }: Route.ComponentProps) {
  const { instance, mode, review, selected, selectedError, selectedPath } = loaderData;

  return (
    <>
      <Breadcrumbs depth={matches.length}>
        <Breadcrumbs.Item to={`/instances/${instance.id}`}>{instance.name}</Breadcrumbs.Item>
        <Breadcrumbs.Item>review</Breadcrumbs.Item>
      </Breadcrumbs>
      <ReviewBrowser
        mode={mode}
        review={review}
        selected={selected}
        selectedError={selectedError}
        selectedPath={selectedPath}
      />
    </>
  );
}
