import { Outlet, useNavigate } from "react-router";

import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { ProjectEventsProvider } from "~/components/events/project-events-provider";
import { useSessionEvents } from "~/components/events/session-events-provider";
import { getSharedOpencodeRuntimeStatus } from "~/lib/opencode/shared-runtime.server";
import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleContext, RouteHandleDefinition } from "~/lib/route-handle";

import type { Route } from "./+types/_layout";
import { getNewSessionIconNavAction } from "./+/project-route";

export const handle: RouteHandleDefinition<Route.ComponentProps> = defineRouteHandle<Route.ComponentProps>({
  leadingIconAction: (ctx: RouteHandleContext<Route.ComponentProps>) => {
    if (ctx.data.runtime.mode === "managed" && !ctx.data.runtime.isRunning) {
      return undefined;
    }

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

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuthenticatedPasskey(request);

  return {
    runtime: await getSharedOpencodeRuntimeStatus(),
  };
}

export default function ProjectLayoutRoute({ loaderData, params }: Route.ComponentProps) {
  const navigate = useNavigate();

  useSessionEvents(
    (event) => {
      if (event.type !== "project.removed" || event.projectId !== params.projectId) {
        return;
      }

      navigate("/projects", { replace: true });
    },
    { types: ["project.removed"] as const },
  );

  return (
    loaderData.runtime.mode === "managed" && !loaderData.runtime.isRunning
      ? <Outlet />
      : (
        <ProjectEventsProvider projectIds={[params.projectId]}>
          <Outlet />
        </ProjectEventsProvider>
      )
  );
}
