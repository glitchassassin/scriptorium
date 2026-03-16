import type { SidebarInstanceRecord } from "~/lib/instances/sidebar";

import { SidebarInstancesNav } from "./sidebar-instances-nav";

type SidebarNavProps = {
  instances: SidebarInstanceRecord[];
};

export function SidebarNav({ instances }: SidebarNavProps) {
  return (
    <nav aria-label="Sidebar" className="pt-2">
      <SidebarInstancesNav instances={instances} />
    </nav>
  );
}
