import { Breadcrumbs } from "~/components/shell/breadcrumbs";
import { ReviewBrowser } from "~/components/workspace/review-browser";
import { getDocumentTitle } from "~/lib/document-title";
import { getServerTimingHeaders, loadProjectUncommittedReviewRouteData } from "~/routes/_app/projects.$projectId/review.server";

import type { Route } from "./+types/review.uncommitted";

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
      <title>{getDocumentTitle("review", project.name)}</title>
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
