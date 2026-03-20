import type { RouteBreadcrumb, RouteHandleIconAction } from "~/lib/route-handle";

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

export function getNewSessionIconNavAction(instanceId: string): RouteHandleIconAction {
  return {
    icon: "mdi:message-plus-outline",
    label: "New session",
    action: `/instances/${instanceId}?index`,
    method: "post",
    fields: {
      intent: "create-session",
    },
  };
}
