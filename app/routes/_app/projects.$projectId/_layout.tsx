import { Outlet } from "react-router";

import { ProjectEventsProvider } from "~/components/events/project-events-provider";
import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleContext, RouteHandleDefinition } from "~/lib/route-handle";

import type { Route } from "./+types/_layout";
import { getNewSessionIconNavAction } from "./+/project-route";

export const handle: RouteHandleDefinition<Route.ComponentProps> = defineRouteHandle<Route.ComponentProps>({
  leadingIconAction: (ctx: RouteHandleContext<Route.ComponentProps>) => {
    const projectId = ctx.params.projectId ?? "";

    return getNewSessionIconNavAction(projectId);
  },
  iconNavActions: (ctx: RouteHandleContext<Route.ComponentProps>) => {
    const projectId = ctx.params.projectId ?? "";

    return [
      {
        icon: "mdi:view-dashboard-outline",
        label: "Project overview",
        to: `/projects/${projectId}`,
        end: true,
      },
      {
        icon: "mdi:source-branch",
        label: "Review",
        to: `/projects/${projectId}/review/uncommitted`,
        end: true,
      },
      {
        icon: "mdi:file-document-multiple-outline",
        label: "Files view",
        to: `/projects/${projectId}/files`,
        end: true,
      },
    ];
  },
});

export default function ProjectLayoutRoute({ params }: Route.ComponentProps) {
  return (
    <ProjectEventsProvider projectIds={[params.projectId]}>
      <Outlet />
    </ProjectEventsProvider>
  );
}
