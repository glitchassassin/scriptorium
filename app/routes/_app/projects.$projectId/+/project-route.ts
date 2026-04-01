import type { RouteHandleIconAction } from "~/lib/route-handle";

export function getProjectName(name?: string | null) {
  return name?.trim() || "Project";
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
