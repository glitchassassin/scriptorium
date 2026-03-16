import { Form, NavLink } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import { SIDEBAR_SESSION_LIMIT, type SidebarInstanceRecord } from "~/lib/instances/sidebar";

type SidebarInstanceItemProps = {
  instance: SidebarInstanceRecord;
};

function sessionLabel(title: string | null, id: string) {
  return title || id.slice(0, 12);
}

export function SidebarInstanceItem({ instance }: SidebarInstanceItemProps) {
  const sessions = instance.recentSessions.slice(0, SIDEBAR_SESSION_LIMIT);

  return (
    <li className="space-y-0.5">
      <div className="flex items-start justify-between gap-2 px-3 py-1">
        <NavLink
          className={({ isActive }) =>
            `block min-h-9 flex-1 py-2 text-base ${isActive ? "text-black underline underline-offset-4" : "text-black"}`
          }
          to={`/instances/${instance.id}`}
        >
          <span className="font-bold">{instance.name}</span>
        </NavLink>
        <Form action={`/instances/${instance.id}`} method="post">
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
        {sessions.map((session) => (
          <li key={session.id}>
            <NavLink
              className={({ isActive }) =>
                `block min-h-9 px-3 py-1 text-sm leading-6 ${isActive ? "text-black underline underline-offset-4" : "text-black"}`
              }
              to={`/instances/${instance.id}/sessions/${session.id}`}
            >
              {sessionLabel(session.title, session.id)}
            </NavLink>
          </li>
        ))}
      </ul>
    </li>
  );
}
