import type { RouteBreadcrumb } from "~/lib/route-handle";

export function getInstanceName(data: unknown) {
  const instance = (data as { instance?: { name?: string } } | undefined)?.instance;
  return instance?.name ?? "Instance";
}

export function getInstanceBreadcrumbs(data: unknown, instanceId?: string): RouteBreadcrumb[] {
  return [
    {
      label: getInstanceName(data),
      ...(instanceId ? { to: `/instances/${instanceId}` } : {}),
    },
  ];
}
