import { useEffect, useState } from "react";
import { Form, NavLink, Outlet, useLocation } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import { SidebarNav } from "~/components/shell/sidebar-nav";
import { useHasVisibleUnreadSessions } from "~/components/shell/sidebar-state";
import { UnreadBadge } from "~/components/ui/unread-badge";
import { cn } from "~/lib/cn";
import type { RouteHandleIconAction } from "~/lib/route-handle";
import safeArea from "~/styles/safe-area.module.css";
import type { AppBreadcrumb } from "~/components/shell/breadcrumbs";

function getIconNavActionClassName(isActive = false) {
  return `inline-flex min-h-11 min-w-11 items-center justify-center ${isActive ? "bg-black text-white" : "bg-white text-black"}`;
}

type AppShellProps = {
  breadcrumbs: AppBreadcrumb[];
  leadingIconAction?: RouteHandleIconAction;
  iconNavActions: RouteHandleIconAction[];
};

function HeaderIconAction({ action }: { action: RouteHandleIconAction }) {
  if ("to" in action) {
    return (
      <NavLink
        aria-label={action.label}
        className={({ isActive }) => getIconNavActionClassName(isActive)}
        end={action.end}
        to={action.to}
      >
        <Icon className="size-6" icon={action.icon} />
      </NavLink>
    );
  }

  return (
    <Form action={action.action} method={action.method}>
      {Object.entries(action.fields ?? {}).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
      <button aria-label={action.label} className={getIconNavActionClassName()} type="submit">
        <Icon className="size-6" icon={action.icon} />
      </button>
    </Form>
  );
}

export function AppShell({ breadcrumbs, leadingIconAction, iconNavActions }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const hasUnreadSidebarSessions = useHasVisibleUnreadSessions();
  const location = useLocation();
  const titleLabel = breadcrumbs.map((breadcrumb) =>
    typeof breadcrumb.content === "string" ? breadcrumb.content : null
  ).filter(Boolean).join(" / ");

  const toggleIcon = isSidebarOpen ? "mdi:menu-open" : "mdi:menu";

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isSidebarOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSidebarOpen]);

  return (
    <main className={`${safeArea.appShell} relative flex min-h-dvh flex-col bg-white text-black`}>
      {isSidebarOpen ? (
        <>
          <button
            aria-label="Close navigation"
            className="fixed inset-0 z-20 bg-white/0"
            onClick={() => setIsSidebarOpen(false)}
            type="button"
          />
            <aside className={`${safeArea.sidebarShell} fixed inset-y-0 left-0 z-30 w-80 border-r-2 border-black bg-white`}>
              <div className="flex h-full flex-col gap-4">
              <header className="flex items-center justify-between gap-3">
                <NavLink
                  className="inline-flex min-h-11 items-center px-3 py-2 text-sm uppercase tracking-[0.08em] text-black"
                  to="/instances"
                >
                  <span className="font-bold">Instances</span>
                </NavLink>
                <button
                  aria-label="Close navigation"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center"
                  onClick={() => setIsSidebarOpen(false)}
                  type="button"
                >
                  <Icon className="size-6" icon="mdi:close" />
                </button>
              </header>
              <div className="flex-1 overflow-y-auto">
                <SidebarNav />
              </div>
              <div className="mt-auto space-y-2 border-t-2 border-black">
                <NavLink
                  className="inline-flex min-h-11 w-full items-center justify-center px-3 py-2 text-base"
                  to="/settings"
                >
                  Settings
                </NavLink>
                <Form action="/logout" method="post">
                  <button
                    className="inline-flex min-h-11 min-w-full items-center justify-center bg-black px-3 py-2 text-base text-white"
                    type="submit"
                  >
                    Log out
                  </button>
                </Form>
              </div>
            </div>
          </aside>
        </>
      ) : null}
      <div className={cn(safeArea.appShellContent, "mx-auto flex w-full max-w-5xl flex-col")}>
        <header className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b-2 border-black">
          <div className="flex items-center gap-0">
            <button
              aria-label="Toggle navigation"
              className="relative inline-flex min-h-11 min-w-11 items-center justify-center"
              onClick={() => setIsSidebarOpen((isOpen) => !isOpen)}
              type="button"
            >
              <Icon className="size-6" icon={toggleIcon} />
              {hasUnreadSidebarSessions ? (
                <span className={cn("pointer-events-none absolute right-1.5 top-0 z-10")}>
                  <UnreadBadge />
                </span>
              ) : null}
            </button>
            {leadingIconAction ? <HeaderIconAction action={leadingIconAction} /> : null}
          </div>
          <div className="min-w-0">
            <h1 aria-label={titleLabel} className="overflow-hidden text-2xl font-bold">
              <span
                className="flex w-full min-w-0 items-center overflow-hidden whitespace-nowrap"
                style={{ ["--count" as string]: breadcrumbs.length }}
              >
                 {breadcrumbs.map((breadcrumb, index) => (
                   <span
                     className="flex flex-[1_1_0] items-center overflow-hidden min-w-[min(max-content,calc(100%/var(--count)))] max-w-max"
                     key={`${breadcrumb.to ?? "breadcrumb"}-${index}`}
                   >
                     {index > 0 ? <span className="mx-2 shrink-0">/</span> : null}
                     {breadcrumb.to ? (
                       <NavLink className="block min-w-0 truncate" to={breadcrumb.to}>
                         {breadcrumb.content}
                       </NavLink>
                     ) : (
                       <span className="block min-w-0 truncate">{breadcrumb.content}</span>
                     )}
                   </span>
                 ))}
              </span>
            </h1>
          </div>
          <div className="flex items-center">
            {iconNavActions.map((action) => (
              <div key={"to" in action ? action.to : `${action.method}:${action.action}:${action.label}`}>
                <HeaderIconAction action={action} />
              </div>
            ))}
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </div>
      </div>
    </main>
  );
}
