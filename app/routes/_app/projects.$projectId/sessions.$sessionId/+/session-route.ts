import type { ProjectRecord } from "~/lib/projects/types";
import type {
  OpencodeMessageWithParts,
  OpencodePermissionRequest,
  OpencodeQuestionRequest,
} from "~/lib/opencode/events";
import type { RouteBreadcrumb, RouteHandleIconAction } from "~/lib/route-handle";

export type SessionTranscriptInitialState = {
  initialHistoryCursor: string | null;
  initialMessages: OpencodeMessageWithParts[];
  initialPermissions: OpencodePermissionRequest[];
  initialQuestions: OpencodeQuestionRequest[];
};

export type SessionRouteContext = {
  actionPath: string;
  project: ProjectRecord;
  insertComposerReference: (reference: string) => void;
  parentSession: { id: string; title?: string | null } | null;
  sessionId: string;
  transcriptInitialState: SessionTranscriptInitialState;
};

export function getSessionName(session?: { title?: string | null; id?: string | null }) {
  return session?.title?.trim() || session?.id?.slice(0, 12) || "Session";
}

export function getSessionBreadcrumbs(args: {
  projectId?: string;
  projectName?: string | null;
  session?: { title?: string | null; id?: string | null };
  sessionId?: string;
}): RouteBreadcrumb[] {
  return [
    {
      label: args.projectName?.trim() || "Project",
      ...(args.projectId ? { to: `/projects/${args.projectId}` } : {}),
    },
    {
      label: getSessionName(args.session),
      ...(args.projectId && args.sessionId ? { to: `/projects/${args.projectId}/sessions/${args.sessionId}` } : {}),
    },
  ];
}

export function getSessionIconNavActions(projectId: string, sessionId: string, reviewMode: "session" | "recent" | "uncommitted" = "uncommitted"): RouteHandleIconAction[] {
  const sessionPath = `/projects/${projectId}/sessions/${sessionId}`;

  return [
    {
      icon: "mdi:message-outline",
      label: "Chat transcript",
      to: sessionPath,
      end: true,
    },
    {
      icon: "mdi:source-branch",
      label: "Review",
      to: `${sessionPath}/review/${reviewMode}`,
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
