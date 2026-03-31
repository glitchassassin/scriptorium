import { SidebarProjectItem } from "./sidebar-project-item";
import { useVisibleSidebarProjects } from "./sidebar-state";

export function SidebarProjectsNav() {
  const visibleProjects = useVisibleSidebarProjects();

  if (!visibleProjects.length) {
    return null;
  }

  return (
    <ul className="space-y-1">
      {visibleProjects.map((project) => (
        <SidebarProjectItem key={project.id} project={project} />
      ))}
    </ul>
  );
}
