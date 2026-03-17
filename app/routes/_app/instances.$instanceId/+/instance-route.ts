import type { RouteBreadcrumb } from "~/lib/route-handle";

export function getInstanceName(name?: string | null) {
  return name?.trim() || "Instance";
}

export function getInstanceBreadcrumbs(instanceName?: string | null, instanceId?: string): RouteBreadcrumb[] {
  return [
    {
      label: getInstanceName(instanceName),
      ...(instanceId ? { to: `/instances/${instanceId}` } : {}),
    },
  ];
}
