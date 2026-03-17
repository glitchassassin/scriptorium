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

export function getSessionName(session?: { title?: string | null; id?: string | null }) {
  return session?.title?.trim() || session?.id?.slice(0, 12) || "Session";
}

export function getSessionBreadcrumbs(args: {
  instanceId?: string;
  instanceName?: string | null;
  session?: { title?: string | null; id?: string | null };
  sessionId?: string;
}): RouteBreadcrumb[] {
  return [
    {
      label: args.instanceName?.trim() || "Instance",
      ...(args.instanceId ? { to: `/instances/${args.instanceId}` } : {}),
    },
    {
      label: getSessionName(args.session),
      ...(args.instanceId && args.sessionId ? { to: `/instances/${args.instanceId}/sessions/${args.sessionId}` } : {}),
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
