import type {
  OpencodeMessageWithParts,
  OpencodePermissionRequest,
  OpencodeSessionInfo,
  OpencodeSessionStatus,
} from "~/lib/opencode/events";
import type { InstanceRecord } from "~/lib/instances/types";
import type { RouteHandleIconAction } from "~/lib/route-handle";

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

export function sessionRouteTitle(data: unknown) {
  const routeData = (data as { instance?: { name?: string }; session?: { title?: string; id?: string } } | undefined);
  const instanceName = routeData?.instance?.name;
  const session = routeData?.session;
  const sessionName = session?.title ?? session?.id?.slice(0, 12) ?? "Session";

  return instanceName ? `${instanceName} / ${sessionName}` : sessionName;
}

export function getSessionIconNavActions(instanceId: string, sessionId: string): RouteHandleIconAction[] {
  const sessionPath = `/instances/${instanceId}/sessions/${sessionId}`;

  return [
    {
      icon: "mdi:view-dashboard-outline",
      label: "Instance overview",
      to: `/instances/${instanceId}`,
      end: true,
    },
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
