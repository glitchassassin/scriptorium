import { Form, NavLink } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import { useSession, useSessionSidebarIndicator } from "~/store/sessions-provider";
import { cn } from "~/lib/cn";
import { SIDEBAR_SESSION_LIMIT } from "~/lib/instances/sidebar";

import { UnreadBadge } from "~/components/ui/unread-badge";
import { type VisibleInstanceState } from "~/components/shell/sidebar-state";

type SidebarInstanceItemProps = {
  instance: VisibleInstanceState;
};

function sessionLabel(title: string | null, id: string) {
  return title || id.slice(0, 12);
}

export function SidebarInstanceItem({ instance }: SidebarInstanceItemProps) {
  const sessions = instance.sessionIds.slice(0, SIDEBAR_SESSION_LIMIT);

  return (
    <li className="space-y-0.5">
      <div className="flex items-start justify-between gap-2 px-3 py-1">
        <NavLink
          className={({ isActive }) => cn("block min-h-9 flex-1 py-2 text-base text-black", { "underline underline-offset-4": isActive })}
          to={`/instances/${instance.id}`}
        >
          <span className="font-bold">{instance.name}</span>
        </NavLink>
        <Form action={`/instances/${instance.id}?index`} method="post">
          <input name="intent" type="hidden" value="create-session" />
          <button
            aria-label={`New session for ${instance.name}`}
            className="inline-flex h-9 min-w-9 items-center justify-center"
            type="submit"
          >
            <Icon className="size-5" icon="mdi:plus" />
          </button>
        </Form>
      </div>
      <ul className="space-y-0.5 pl-6">
        {sessions.map((sessionId) => (
          <SidebarSessionItem instanceId={instance.id} key={sessionId} sessionId={sessionId} />
        ))}
      </ul>
    </li>
  );
}

function SidebarSessionItem({ instanceId, sessionId }: { instanceId: string; sessionId: string }) {
  const session = useSession(sessionId);
  const indicator = useSessionSidebarIndicator(sessionId);

  if (!session) {
    return null;
  }

  return (
    <li>
      <NavLink
        className={() => cn(
          "grid min-h-9 grid-cols-[0.5rem_minmax(0,1fr)] items-center gap-2 px-3 py-1 text-sm leading-6",
          "text-black",
        )}
        to={`/instances/${instanceId}/sessions/${sessionId}`}
        >
          {({ isActive }) => (
            <>
              <span className="flex justify-center">{indicator !== "none" ? <UnreadBadge variant={indicator} /> : null}</span>
              <span className={cn({ "underline underline-offset-4": isActive })}>{sessionLabel(session.title, sessionId)}</span>
            </>
          )}
      </NavLink>
    </li>
  );
}
