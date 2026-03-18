import { SidebarInstanceItem } from "./sidebar-instance-item";
import { useVisibleSidebarInstances } from "./sidebar-state";
export function SidebarInstancesNav() {
  const visibleInstances = useVisibleSidebarInstances();

  if (!visibleInstances.length) {
    return null;
  }

  return (
    <ul className="space-y-1">
      {visibleInstances.map((instance) => (
        <SidebarInstanceItem instance={instance} key={instance.id} />
      ))}
    </ul>
  );
}
