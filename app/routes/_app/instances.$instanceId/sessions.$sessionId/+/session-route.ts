import type {
  OpencodeMessageWithParts,
  OpencodePermissionRequest,
  OpencodeSessionInfo,
  OpencodeSessionStatus,
} from "~/lib/opencode/events";
import type { InstanceRecord } from "~/lib/instances/types";
import type { RouteBreadcrumb, RouteHandleIconAction } from "~/lib/route-handle";

export type SessionRouteContext = {
  instance: InstanceRecord;
  insertComposerReference: (reference: string) => void;
  messages: OpencodeMessageWithParts[];
  pendingPermissions: OpencodePermissionRequest[];
  replyPermission: (requestId: string, reply: "once" | "always" | "reject") => Promise<void>;
  session: OpencodeSessionInfo;
  sessionError: string | null;
  status: OpencodeSessionStatus;
};

export function getSessionName(data: unknown) {
  const routeData = (data as { instance?: { name?: string }; session?: { title?: string; id?: string } } | undefined);
  const session = routeData?.session;
  return session?.title ?? session?.id?.slice(0, 12) ?? "Session";
}

export function getSessionDataFromMatches(matches: Array<{ data?: unknown }>) {
  return matches
    .map((match) => match.data)
    .find((data) => {
      const routeData = data as { session?: { title?: string; id?: string } } | undefined;
      return Boolean(routeData?.session);
    });
}

export function getSessionBreadcrumbs(data: unknown, instanceId?: string, sessionId?: string): RouteBreadcrumb[] {
  const routeData = (data as { instance?: { name?: string } } | undefined);

  return [
    {
      label: routeData?.instance?.name ?? "Instance",
      ...(instanceId ? { to: `/instances/${instanceId}` } : {}),
    },
    {
      label: getSessionName(data),
      ...(instanceId && sessionId ? { to: `/instances/${instanceId}/sessions/${sessionId}` } : {}),
    },
  ];
}

export function getSessionIconNavActions(instanceId: string, sessionId: string): RouteHandleIconAction[] {
  const sessionPath = `/instances/${instanceId}/sessions/${sessionId}`;

  return [
    {
      icon: "mdi:message-outline",
      label: "Chat transcript",
      to: sessionPath,
      end: true,
    },
    {
      icon: "mdi:source-branch",
      label: "Git view",
      to: `${sessionPath}/git`,
      end: true,
    },
    {
      icon: "mdi:file-document-multiple-outline",
      label: "Files view",
      to: `${sessionPath}/files`,
      end: true,
    },
  ];
}
