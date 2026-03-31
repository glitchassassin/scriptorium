import { Breadcrumbs } from "~/components/shell/breadcrumbs";
import { ReviewBrowser } from "~/components/workspace/review-browser";
import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleDefinition } from "~/lib/route-handle";
import { getServerTimingHeaders, loadProjectUncommittedReviewRouteData } from "~/routes/_app/projects.$projectId/review.server";

import { getProjectBreadcrumbs } from "./+/project-route";

import type { Route } from "./+types/review.uncommitted";

export const handle: RouteHandleDefinition<Route.ComponentProps> = defineRouteHandle<Route.ComponentProps>({
  title: ({ data, params }) => [
    ...getProjectBreadcrumbs(data?.project?.name, params.projectId),
    { label: "review" },
  ],
});

export async function loader({ params, request }: Route.LoaderArgs) {
  return loadProjectUncommittedReviewRouteData({
    projectId: params.projectId,
    request,
  });
}

export function headers(args: Route.HeadersArgs) {
  return getServerTimingHeaders(args);
}

export default function ProjectReviewRoute({ loaderData, matches }: Route.ComponentProps) {
  const { project, mode, review, selected, selectedError, selectedPath } = loaderData;

  return (
    <>
      <Breadcrumbs depth={matches.length}>
        <Breadcrumbs.Item to={`/projects/${project.id}`}>{project.name}</Breadcrumbs.Item>
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
