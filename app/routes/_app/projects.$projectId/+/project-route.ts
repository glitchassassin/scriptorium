import type { RouteBreadcrumb, RouteHandleIconAction } from "~/lib/route-handle";

export function getProjectName(name?: string | null) {
  return name?.trim() || "Project";
}

export function getProjectBreadcrumbs(projectName?: string | null, projectId?: string): RouteBreadcrumb[] {
  return [
    {
      label: getProjectName(projectName),
      ...(projectId ? { to: `/projects/${projectId}` } : {}),
    },
  ];
}

export function getNewSessionIconNavAction(projectId: string): RouteHandleIconAction {
  return {
    icon: "mdi:message-plus-outline",
    label: "New session",
    action: `/projects/${projectId}?index`,
    method: "post",
    fields: {
      intent: "create-session",
    },
  };
}
