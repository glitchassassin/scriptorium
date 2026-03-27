import { Link } from "react-router";

import type { OpencodeSessionSummary } from "~/lib/instances/types";

type InstanceSessionListProps = {
  instanceId: string;
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

function SessionBranch({ instanceId, nodes }: { instanceId: string; nodes: SessionNode[] }) {
  return (
    <ul className="space-y-2 border-l-2 border-black pl-4">
      {nodes.map((node) => (
        <li className="space-y-2" key={node.session.id}>
          <Link className="block space-y-1" to={`/instances/${instanceId}/sessions/${node.session.id}`}>
            <p className="text-base font-bold">{sessionLabel(node.session)}</p>
            {node.session.updatedAt ? (
              <p className="text-sm leading-6 opacity-60">
                Updated {new Date(node.session.updatedAt).toLocaleString()}
              </p>
            ) : null}
          </Link>
          {node.children.length ? <SessionBranch instanceId={instanceId} nodes={node.children} /> : null}
        </li>
      ))}
    </ul>
  );
}

export function InstanceSessionList({ instanceId, sessions }: InstanceSessionListProps) {
  const roots = buildSessionTree(sessions);

  if (!roots.length) {
    return <p className="text-base leading-6">No Opencode sessions were found for this instance.</p>;
  }

  return (
    <ul className="border-t-2 border-black">
      {roots.map((node) => (
        <li className="space-y-2 border-b-2 border-black px-3 py-2" key={node.session.id}>
          <Link className="block space-y-1" to={`/instances/${instanceId}/sessions/${node.session.id}`}>
            <p className="text-base font-bold">{sessionLabel(node.session)}</p>
            {node.session.updatedAt ? (
              <p className="text-sm leading-6 opacity-60">
                Updated {new Date(node.session.updatedAt).toLocaleString()}
              </p>
            ) : null}
          </Link>
          {node.children.length ? <SessionBranch instanceId={instanceId} nodes={node.children} /> : null}
        </li>
      ))}
    </ul>
  );
}
