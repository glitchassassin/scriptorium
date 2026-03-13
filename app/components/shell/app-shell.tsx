import { useEffect, useState } from "react";
import { Form, NavLink, Outlet, useLocation, useMatches } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import type { RouteHandle } from "~/lib/route-handle";

type AppShellProps = {
  passkeyLabel: string;
};

export function AppShell({ passkeyLabel }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const matches = useMatches();
  const metadata = [...matches].reverse().find((match) => {
    const handle = match.handle as RouteHandle | undefined;
    return handle?.title || handle?.iconNavActions;
  });
  const handle = metadata?.handle as RouteHandle | undefined;
  const title = typeof handle?.title === "function"
    ? handle.title({ data: metadata?.data, params: metadata?.params ?? {} })
    : handle?.title;
  const iconNavActions = typeof handle?.iconNavActions === "function"
    ? handle.iconNavActions({ data: metadata?.data, params: metadata?.params ?? {} })
    : handle?.iconNavActions ?? [];

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
    <main className="relative h-screen bg-white px-6 text-black sm:px-8">
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
              <header className="flex items-center justify-end">
                <button
                  aria-label="Close navigation"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center"
                  onClick={() => setIsSidebarOpen(false)}
                  type="button"
                >
                  <Icon className="size-6" icon="mdi:close" />
                </button>
              </header>
              <div className="flex-1" />
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
          <div>
            <h1 className="text-2xl font-bold">{title ?? "Scriptorium"}</h1>
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
