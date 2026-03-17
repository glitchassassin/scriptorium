import { Outlet } from "react-router";

import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleContext, RouteHandleDefinition } from "~/lib/route-handle";

import type { Route } from "./+types/_layout";

export const handle: RouteHandleDefinition<Route.ComponentProps> = defineRouteHandle<Route.ComponentProps>({
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
        label: "Git view",
        to: `/instances/${instanceId}/git`,
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

export default function InstanceLayoutRoute(_: Route.ComponentProps) {
  return <Outlet />;
}
