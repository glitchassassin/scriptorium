import { Outlet } from "react-router";

import type { RouteHandle } from "~/lib/route-handle";

import { getInstanceBreadcrumbs } from "./+/instance-route";

import type { Route } from "./+types/_layout";

export const handle = {
  title: ({ data, params }: { data?: unknown; params: Record<string, string | undefined> }) =>
    getInstanceBreadcrumbs(data, params["instanceId"]),
  iconNavActions: ({ params }: { params: Record<string, string | undefined> }) => {
    const instanceId = params["instanceId"] ?? "";

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
} satisfies RouteHandle;

export default function InstanceLayoutRoute(_: Route.ComponentProps) {
  return <Outlet />;
}
