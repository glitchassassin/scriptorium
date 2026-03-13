import type { RouteHandle } from "~/lib/route-handle";
import { ScrollableLayout } from "~/components/shell/scrollable-layout";

export const handle = {
  title: "Workspace",
  iconNavActions: [
    {
      icon: "mdi:server-outline",
      label: "Instances",
      to: "/instances",
    },
  ],
} satisfies RouteHandle;

export default function AppIndexRoute() {
  return (
    <ScrollableLayout>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-3 border-t-2 border-black pt-4">
          <p className="text-sm uppercase tracking-[0.08em]">Auth status</p>
          <p className="text-base leading-6">
            Cookie-backed sessions, public registration, and console-confirmed passkey activation are in place.
          </p>
        </section>
        <section className="space-y-3 border-t-2 border-black pt-4">
          <p className="text-sm uppercase tracking-[0.08em]">Instances</p>
          <p className="text-base leading-6">
            Manage Opencode workspaces, inspect git state, and browse recent sessions from the instances view.
          </p>
        </section>
      </div>
    </ScrollableLayout>
  );
}
