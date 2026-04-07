import { Link, useFetcher } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import { UnreadBadge } from "~/components/ui/unread-badge";
import { useDoubleCheck } from "~/hooks/use-double-check";
import { useSession, useSessionSidebarIndicator } from "~/store/sessions-provider";
import { isSessionUnread, type SidebarSessionRecord } from "~/lib/projects/sidebar";
import type { OpencodeSessionStatus } from "~/lib/projects/types";

type ProjectSessionListProps = {
  projectId: string;
  sessions: SidebarSessionRecord[];
  initialSessionStatuses?: Record<string, OpencodeSessionStatus>;
};

type SessionNode = {
  children: SessionNode[];
  session: SidebarSessionRecord;
};

function sessionLabel(session: SidebarSessionRecord) {
  return session.title || session.id.slice(0, 12);
}

function buildSessionTree(sessions: SidebarSessionRecord[]) {
  const ids = new Set(sessions.map((session) => session.id));
  const children = new Map<string, SidebarSessionRecord[]>();
  const roots: SidebarSessionRecord[] = [];

  for (const session of sessions) {
    if (session.parentID && ids.has(session.parentID)) {
      const list = children.get(session.parentID);

      if (list) {
        list.push(session);
      } else {
        children.set(session.parentID, [session]);
      }

      continue;
    }

    roots.push(session);
  }

  const seen = new Set<string>();

  function visit(session: SidebarSessionRecord): SessionNode {
    if (seen.has(session.id)) {
      return { children: [], session };
    }

    seen.add(session.id);
    return {
      children: (children.get(session.id) ?? []).map(visit),
      session,
    };
  }

  return [
    ...roots.map(visit),
    ...sessions.filter((session) => !seen.has(session.id)).map(visit),
  ];
}

function getUnreadIndicator(session: SidebarSessionRecord, status: OpencodeSessionStatus | undefined, topLevel: boolean) {
  if (!topLevel || !isSessionUnread(session, session.lastReadAt)) {
    return "none" as const;
  }

  return (status?.type ?? "idle") === "idle" ? "solid" as const : "hollow" as const;
}

function SessionBranch({ projectId, nodes, sessionStatuses }: {
  projectId: string;
  nodes: SessionNode[];
  sessionStatuses: Record<string, OpencodeSessionStatus>;
}) {
  return (
    <ul className="space-y-2 border-l-2 border-black pl-4">
      {nodes.map((node) => (
        <SessionRowWithIndicator
          key={node.session.id}
          node={node}
          projectId={projectId}
          sessionStatuses={sessionStatuses}
        />
      ))}
    </ul>
  );
}

function SessionRowWithIndicator({
  node,
  projectId,
  sessionStatuses,
  topLevel = false,
}: {
  node: SessionNode;
  projectId: string;
  sessionStatuses: Record<string, OpencodeSessionStatus>;
  topLevel?: boolean;
}) {
  const session = useSession(node.session.id) ?? node.session;
  const liveIndicator = useSessionSidebarIndicator(node.session.id);
  const indicator = topLevel
    ? (liveIndicator !== "none"
      ? liveIndicator
      : getUnreadIndicator(session, sessionStatuses[node.session.id], topLevel))
    : "none";
  const fetcher = useFetcher();
  const { doubleCheck, getButtonProps } = useDoubleCheck();
  const isDeleting = fetcher.state !== "idle";
  const label = sessionLabel(session);
  const buttonLabel = doubleCheck ? `Confirm delete ${label}` : `Delete ${label}`;
  const icon = doubleCheck ? "mdi:help" : "mdi:trash-can-outline";

  return (
    <li className={topLevel ? "space-y-2 border-b-2 border-black px-3 py-2" : "space-y-2 py-1"}>
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <Link className="block min-w-0 space-y-1" to={`/projects/${projectId}/sessions/${session.id}`}>
          <p className="flex items-center gap-2 text-base font-bold">
            {indicator !== "none" ? <UnreadBadge variant={indicator} /> : null}
            <span>{label}</span>
          </p>
          {session.updatedAt ? (
            <p className="text-sm leading-6 opacity-60">
              Updated {new Date(session.updatedAt).toLocaleString()}
            </p>
          ) : null}
        </Link>
        {topLevel ? (
          <div className="flex items-center justify-between gap-3 md:justify-end">
            <fetcher.Form method="post">
              <input name="intent" type="hidden" value="delete-session" />
              <input name="sessionId" type="hidden" value={session.id} />
              <button
                aria-label={buttonLabel}
                className="inline-flex min-h-11 min-w-11 items-center justify-center disabled:opacity-25"
                disabled={isDeleting}
                type="submit"
                {...getButtonProps()}
              >
                <Icon className="size-6" icon={icon} />
              </button>
            </fetcher.Form>
          </div>
        ) : null}
      </div>
      {node.children.length ? <SessionBranch nodes={node.children} projectId={projectId} sessionStatuses={sessionStatuses} /> : null}
    </li>
  );
}

export function ProjectSessionList({ projectId, sessions, initialSessionStatuses = {} }: ProjectSessionListProps) {
  const roots = buildSessionTree(sessions);

  if (!roots.length) {
    return <p className="text-base leading-6">No Opencode sessions were found for this project.</p>;
  }

  return (
    <ul className="border-t-2 border-black">
      {roots.map((node) => (
        <SessionRowWithIndicator
          key={node.session.id}
          node={node}
          projectId={projectId}
          sessionStatuses={initialSessionStatuses}
          topLevel
        />
      ))}
    </ul>
  );
}
