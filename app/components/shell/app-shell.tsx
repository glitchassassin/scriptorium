import { useEffect, useState } from "react";
import { Form, NavLink, Outlet, useLocation, useMatches } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import { SidebarNav } from "~/components/shell/sidebar-nav";
import type { SidebarInstanceRecord } from "~/lib/instances/sidebar";
import type { RouteBreadcrumb, RouteHandle, RouteHandleIconAction, RouteHandleMatchContext } from "~/lib/route-handle";

type AppShellProps = {
  sidebarInstances: SidebarInstanceRecord[];
};

type RouteHandleKey = keyof Pick<RouteHandle, "title" | "iconNavActions">;
type ResolvedHandleValueMap = {
  title: RouteBreadcrumb[];
  iconNavActions: RouteHandleIconAction[];
};
function getResolvedHandleValue<K extends RouteHandleKey>(
  matches: ReturnType<typeof useMatches>,
  key: K,
): ResolvedHandleValueMap[K] | undefined {
  const metadata = [...matches].reverse().find((match) => {
    const handle = match.handle as RouteHandle | undefined;
    return handle?.[key];
  });
  const handle = metadata?.handle as RouteHandle | undefined;
  const value = handle?.[key];

  if (typeof value === "function") {
    const matchContext = {
      data: metadata?.data,
      params: metadata?.params ?? {},
      matches: matches.map((match) => ({ data: match.data, params: match.params ?? {} })),
    } satisfies RouteHandleMatchContext;

    return value(matchContext) as ResolvedHandleValueMap[K];
  }

  return value as ResolvedHandleValueMap[K] | undefined;
}

export function AppShell({ sidebarInstances }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const matches = useMatches();
  const title: RouteBreadcrumb[] = getResolvedHandleValue(matches, "title") ?? [{ label: "Scriptorium" }];
  const titleLabel = title.map((breadcrumb) => breadcrumb.label).join(" / ");
  const iconNavActions: RouteHandleIconAction[] = getResolvedHandleValue(matches, "iconNavActions") ?? [];

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
    <main className="relative h-dvh bg-white text-black">
      {isSidebarOpen ? (
        <>
          <button
            aria-label="Close navigation"
            className="fixed inset-0 z-20 bg-white/0"
            onClick={() => setIsSidebarOpen(false)}
            type="button"
          />
           <aside className="fixed inset-y-0 left-0 z-30 w-80 border-r-2 border-black bg-white p-4">
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
                <SidebarNav instances={sidebarInstances} />
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
      <div className="mx-auto flex h-full max-w-5xl flex-col">
        <header className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b-2 border-black">
          <button
            aria-label="Toggle navigation"
            className="inline-flex min-h-11 min-w-11 items-center justify-center"
            onClick={() => setIsSidebarOpen((isOpen) => !isOpen)}
            type="button"
          >
            <Icon className="size-6" icon={toggleIcon} />
          </button>
          <div className="min-w-0">
            <h1 aria-label={titleLabel} className="overflow-hidden text-2xl font-bold">
              <span
                className="flex w-full min-w-0 items-center overflow-hidden whitespace-nowrap"
                style={{ ["--count" as string]: title.length }}
              >
                {title.map((breadcrumb, index) => (
                  <span
                    className="flex flex-[1_1_0] items-center overflow-hidden min-w-[min(max-content,calc(100%/var(--count)))] max-w-max"
                    key={`${breadcrumb.to ?? breadcrumb.label}-${index}`}
                  >
                    {index > 0 ? <span className="mx-2 shrink-0">/</span> : null}
                    {breadcrumb.to ? (
                      <NavLink className="block min-w-0 truncate" to={breadcrumb.to}>
                        {breadcrumb.label}
                      </NavLink>
                    ) : (
                      <span className="block min-w-0 truncate">{breadcrumb.label}</span>
                    )}
                  </span>
                ))}
              </span>
            </h1>
          </div>
          <div className="flex items-center">
            {iconNavActions.map((action) => (
              <NavLink
                aria-label={action.label}
                className={({ isActive }) =>
                  `inline-flex min-h-11 min-w-11 items-center justify-center ${isActive ? "bg-black text-white" : "bg-white text-black"}`
                }
                end={action.end}
                key={action.to}
                to={action.to}
              >
                <Icon className="size-6" icon={action.icon} />
              </NavLink>
            ))}
          </div>
        </header>
        <Outlet />
      </div>
    </main>
  );
}
