import type { Route } from "./+types/_layout";

import { SessionEventsProvider } from "~/components/events/session-events-provider";
import { useBrowserResumeRevalidation } from "~/components/events/use-browser-resume-revalidation";
import { BreadcrumbsProvider, useBreadcrumbs } from "~/components/shell/breadcrumbs";
import { getInitialProjects, ProjectsProvider } from "~/store/projects-provider";
import { SessionsProvider } from "~/store/sessions-provider";
import { AppShell } from "~/components/shell/app-shell";
import { data } from "react-router";
import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { listProjects } from "~/lib/projects/runtime.server";
import { sortSidebarProjects } from "~/lib/projects/sidebar";
import { loadSidebarProjectState } from "~/lib/projects/sidebar.server";
import { normalizeRouteHandleMatches, resolveRouteHandleValue, type RouteHandleIconAction } from "~/lib/route-handle";
import { getServerTimingHeaders, makeTimings, time } from "~/lib/server-timing.server";
import { listSessionReadStatuses } from "~/lib/session-read-status.server";

const IDLE_SESSION_STATUS = { type: "idle" } as const;

export async function loader({ request }: Route.LoaderArgs) {
  const timings = makeTimings("app layout loader");

  await time(() => requireAuthenticatedPasskey(request), {
    desc: "require authenticated passkey",
    timings,
    type: "auth",
  });
  const projects = await time(() => listProjects(), {
    desc: "list projects",
    timings,
    type: "projects",
  });
  const readStatuses = await time(() => listSessionReadStatuses(), {
    desc: "list read statuses",
    timings,
    type: "read statuses",
  });
  const readStatusMap = new Map(
    readStatuses.map((status) => [status.sessionId, status.lastReadAt]),
  );
  const sidebarProjects = sortSidebarProjects(await time(
    () => Promise.all(projects.map((project) => loadSidebarProjectState(project, readStatusMap))),
    {
      desc: "list sidebar sessions",
      timings,
      type: "sidebar sessions",
    },
  ));
  const initialSessions = Object.fromEntries(
    sidebarProjects.flatMap((project) =>
      project.recentSessions.map((session) => [
        session.id,
        session,
      ] as const),
    ),
  );
  const initialSessionStatuses = Object.fromEntries(
    sidebarProjects.flatMap((project) =>
      project.recentSessions.map((session) => [
        session.id,
        project.recentSessionStatuses[session.id] ?? IDLE_SESSION_STATUS,
      ] as const),
    ),
  );
  const initialProjects = getInitialProjects(sidebarProjects);

  return data(
    {
      initialProjects,
      initialSessions,
      initialSessionStatuses,
    },
    {
      headers: {
        "Server-Timing": timings.toString(),
      },
    },
  );
}

export function headers(args: Route.HeadersArgs) {
  return getServerTimingHeaders(args);
}

function AppLayoutShell({
  breadcrumbsFallback,
  iconNavActions,
  leadingIconAction,
}: {
  breadcrumbsFallback: { content: string }[];
  iconNavActions: RouteHandleIconAction[];
  leadingIconAction?: RouteHandleIconAction;
}) {
  const breadcrumbs = useBreadcrumbs();

  return (
    <AppShell
      breadcrumbs={breadcrumbs.length ? breadcrumbs : breadcrumbsFallback}
      leadingIconAction={leadingIconAction}
      iconNavActions={iconNavActions ?? []}
    />
  );
}

export default function AppLayout({ loaderData, matches }: Route.ComponentProps) {
  useBrowserResumeRevalidation();
  const routeMatches = normalizeRouteHandleMatches(matches);
  const leadingIconAction = resolveRouteHandleValue(routeMatches, "leadingIconAction");
  const iconNavActions = resolveRouteHandleValue(routeMatches, "iconNavActions") ?? [];

  return (
    <SessionEventsProvider>
      <SessionsProvider initialSessions={loaderData.initialSessions} initialStatuses={loaderData.initialSessionStatuses}>
        <ProjectsProvider initialProjects={loaderData.initialProjects}>
          <BreadcrumbsProvider>
            <AppLayoutShell
              breadcrumbsFallback={[{ content: "Scriptorium" }]}
              leadingIconAction={leadingIconAction}
              iconNavActions={iconNavActions}
            />
          </BreadcrumbsProvider>
        </ProjectsProvider>
      </SessionsProvider>
    </SessionEventsProvider>
  );
}
