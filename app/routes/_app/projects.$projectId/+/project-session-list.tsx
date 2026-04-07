import { Link, useFetcher } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import { useDoubleCheck } from "~/hooks/use-double-check";
import type { OpencodeSessionSummary } from "~/lib/projects/types";

type ProjectSessionListProps = {
  projectId: string;
  sessions: OpencodeSessionSummary[];
};

type SessionNode = {
  children: SessionNode[];
  session: OpencodeSessionSummary;
};

function sessionLabel(session: OpencodeSessionSummary) {
  return session.title || session.id.slice(0, 12);
}

function buildSessionTree(sessions: OpencodeSessionSummary[]) {
  const ids = new Set(sessions.map((session) => session.id));
  const children = new Map<string, OpencodeSessionSummary[]>();
  const roots: OpencodeSessionSummary[] = [];

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

  function visit(session: OpencodeSessionSummary): SessionNode {
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

function SessionRow({ node, projectId, topLevel = false }: { node: SessionNode; projectId: string; topLevel?: boolean }) {
  const fetcher = useFetcher();
  const { doubleCheck, getButtonProps } = useDoubleCheck();
  const isDeleting = fetcher.state !== "idle";
  const label = sessionLabel(node.session);
  const buttonLabel = doubleCheck ? `Confirm delete ${label}` : `Delete ${label}`;
  const icon = doubleCheck ? "mdi:help" : "mdi:trash-can-outline";

  return (
    <li className={topLevel ? "space-y-2 border-b-2 border-black px-3 py-2" : "space-y-2 py-1"}>
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <Link className="block min-w-0 space-y-1" to={`/projects/${projectId}/sessions/${node.session.id}`}>
          <p className="text-base font-bold">{label}</p>
          {node.session.updatedAt ? (
            <p className="text-sm leading-6 opacity-60">
              Updated {new Date(node.session.updatedAt).toLocaleString()}
            </p>
          ) : null}
        </Link>
        {topLevel ? (
          <div className="flex items-center justify-between gap-3 md:justify-end">
            <fetcher.Form method="post">
              <input name="intent" type="hidden" value="delete-session" />
              <input name="sessionId" type="hidden" value={node.session.id} />
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
      {node.children.length ? <SessionBranch nodes={node.children} projectId={projectId} /> : null}
    </li>
  );
}

function SessionBranch({ projectId, nodes }: { projectId: string; nodes: SessionNode[] }) {
  return (
    <ul className="space-y-2 border-l-2 border-black pl-4">
      {nodes.map((node) => (
        <SessionRow key={node.session.id} node={node} projectId={projectId} />
      ))}
    </ul>
  );
}

export function ProjectSessionList({ projectId, sessions }: ProjectSessionListProps) {
  const roots = buildSessionTree(sessions);

  if (!roots.length) {
    return <p className="text-base leading-6">No Opencode sessions were found for this project.</p>;
  }

  return (
    <ul className="border-t-2 border-black">
      {roots.map((node) => (
        <SessionRow key={node.session.id} node={node} projectId={projectId} topLevel />
      ))}
    </ul>
  );
}
