import { FilesBrowser } from "~/components/workspace/files-browser";
import { Breadcrumbs } from "~/components/shell/breadcrumbs";
import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleDefinition } from "~/lib/route-handle";
import { getServerTimingHeaders } from "~/lib/server-timing.server";

import { getProjectBreadcrumbs } from "./+/project-route";
import { loadProjectFilesRouteData } from "./files.server";

import type { Route } from "./+types/files";

export const handle: RouteHandleDefinition<Route.ComponentProps> = defineRouteHandle<Route.ComponentProps>({
  title: ({ data, params }) => [
    ...getProjectBreadcrumbs(data?.project?.name, params.projectId),
    { label: "files" },
  ],
});

export async function loader({ params, request }: Route.LoaderArgs) {
  const projectId = params.projectId;

  return loadProjectFilesRouteData({ projectId, request });
}

export function headers(args: Route.HeadersArgs) {
  return getServerTimingHeaders(args);
}

export default function ProjectFilesRoute({ loaderData, matches }: Route.ComponentProps) {
  const { project, listing, selected, selectedError, selectedLineRange, selectedPath } = loaderData;

  return (
    <>
      <Breadcrumbs depth={matches.length}>
        <Breadcrumbs.Item to={`/projects/${project.id}`}>{project.name}</Breadcrumbs.Item>
        <Breadcrumbs.Item>files</Breadcrumbs.Item>
      </Breadcrumbs>
      <FilesBrowser
        listing={listing}
        rootPath={project.directory}
        selected={selected}
        selectedError={selectedError}
        selectedLineRange={selectedLineRange}
        selectedPath={selectedPath}
      />
    </>
  );
}
