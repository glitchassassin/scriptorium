import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleDefinition } from "~/lib/route-handle";
import { Breadcrumbs } from "~/components/shell/breadcrumbs";
import { ScrollableLayout } from "~/components/shell/scrollable-layout";

import type { Route } from "./+types/index";

export const handle: RouteHandleDefinition<Route.ComponentProps> = defineRouteHandle<Route.ComponentProps>({
  title: [{ label: "Workspace" }],
  iconNavActions: [
    {
      icon: "mdi:server-outline",
      label: "Instances",
      to: "/instances",
    },
  ],
});

export default function AppIndexRoute({ matches }: Route.ComponentProps) {
  return (
    <>
      <Breadcrumbs depth={matches.length}>
        <Breadcrumbs.Item>Workspace</Breadcrumbs.Item>
      </Breadcrumbs>
      <ScrollableLayout>
        <div className="grid gap-6 pt-6 md:grid-cols-2">
          <section className="space-y-3 border-t-2 border-black pt-4">
            <p className="px-6 text-sm uppercase tracking-[0.08em] sm:px-8">Auth status</p>
            <p className="text-base leading-6">
              Cookie-backed sessions, public registration, and console-confirmed passkey activation are in place.
            </p>
          </section>
          <section className="space-y-3 border-t-2 border-black pt-4">
            <p className="px-6 text-sm uppercase tracking-[0.08em] sm:px-8">Instances</p>
            <p className="text-base leading-6">
              Manage Opencode workspaces, inspect git state, and browse recent sessions from the instances view.
            </p>
          </section>
        </div>
      </ScrollableLayout>
    </>
  );
}
