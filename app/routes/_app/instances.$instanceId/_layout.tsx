import { Outlet } from "react-router";

import { InstanceEventsProvider } from "~/components/events/instance-events-provider";
import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleContext, RouteHandleDefinition } from "~/lib/route-handle";

import type { Route } from "./+types/_layout";
import { getNewSessionIconNavAction } from "./+/instance-route";

export const handle: RouteHandleDefinition<Route.ComponentProps> = defineRouteHandle<Route.ComponentProps>({
  leadingIconAction: (ctx: RouteHandleContext<Route.ComponentProps>) => {
    const instanceId = ctx.params.instanceId ?? "";

    return getNewSessionIconNavAction(instanceId);
  },
  iconNavActions: (ctx: RouteHandleContext<Route.ComponentProps>) => {
    const instanceId = ctx.params.instanceId ?? "";

    return [
      {
        icon: "mdi:view-dashboard-outline",
        label: "Instance overview",
        to: `/instances/${instanceId}`,
        end: true,
      },
      {
        icon: "mdi:source-branch",
        label: "Review",
        to: `/instances/${instanceId}/review/uncommitted`,
        end: true,
      },
      {
        icon: "mdi:file-document-multiple-outline",
        label: "Files view",
        to: `/instances/${instanceId}/files`,
        end: true,
      },
    ];
  },
});

export default function InstanceLayoutRoute({ params }: Route.ComponentProps) {
  return (
    <InstanceEventsProvider instanceIds={[params.instanceId]}>
      <Outlet />
    </InstanceEventsProvider>
  );
}
