import { data, Link, useFetcher } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import { ScrollableLayout } from "~/components/shell/scrollable-layout";
import { Breadcrumbs } from "~/components/shell/breadcrumbs";
import { useDoubleCheck } from "~/hooks/use-double-check";
import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { getDocumentTitle } from "~/lib/document-title";
import { listProjects, removeProject } from "~/lib/projects/runtime.server";
import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleDefinition } from "~/lib/route-handle";
import { getServerTimingHeaders, makeTimings, time } from "~/lib/server-timing.server";
import { useSortedProjects, type ProjectState } from "~/store/projects-provider";

import type { Route } from "./+types/projects";

export const handle: RouteHandleDefinition<Route.ComponentProps> = defineRouteHandle<Route.ComponentProps>({
  iconNavActions: [
    {
      icon: "mdi:plus",
      label: "New project",
      to: "/projects/new",
      end: true,
    },
  ],
});

export async function loader({ request }: Route.LoaderArgs) {
  const timings = makeTimings("projects loader");

  await time(() => requireAuthenticatedPasskey(request), {
    desc: "require authenticated passkey",
    timings,
    type: "auth",
  });

  return data(
      {
      projects: await time(() => listProjects(), {
        desc: "list projects",
        timings,
        type: "projects",
      }),
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

export async function action({ request }: Route.ActionArgs) {
  await requireAuthenticatedPasskey(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "").trim();
  const projectId = String(formData.get("projectId") || "").trim();

  if (intent !== "delete" || !projectId) {
    return data({ error: "That action is not supported." }, { status: 400 });
  }

  await removeProject(projectId);

  return data({ error: null });
}

function ProjectRow({ project }: { project: ProjectState }) {
  const fetcher = useFetcher<typeof action>();
  const { doubleCheck, getButtonProps } = useDoubleCheck();
  const isDeleting = fetcher.state !== "idle";
  const icon = doubleCheck ? "mdi:help" : "mdi:trash-can-outline";
  const label = doubleCheck ? `Confirm delete ${project.name}` : `Delete ${project.name}`;

  return (
    <li className="grid gap-3 border-b-2 border-black px-3 py-3 md:grid-cols-[1fr_auto] md:items-center">
      <Link className="block min-w-0 space-y-1" to={`/projects/${project.id}`}>
        <p className="truncate text-lg font-bold">{project.name}</p>
        <p className="truncate text-sm leading-6">{project.directory}</p>
      </Link>
      <div className="flex items-center justify-between gap-3 md:justify-end">
        <fetcher.Form method="post">
          <input name="intent" type="hidden" value="delete" />
          <input name="projectId" type="hidden" value={project.id} />
          <button
            aria-label={label}
            className="inline-flex min-h-11 min-w-11 items-center justify-center disabled:opacity-25"
            disabled={isDeleting}
            type="submit"
            {...getButtonProps()}
          >
            <Icon className="size-6" icon={icon} />
          </button>
        </fetcher.Form>
      </div>
    </li>
  );
}

export default function ProjectsRoute({ actionData, matches }: Route.ComponentProps) {
  const projects = useSortedProjects();

  return (
    <>
      <title>{getDocumentTitle("Projects")}</title>
      <Breadcrumbs depth={matches.length}>
        <Breadcrumbs.Item>Projects</Breadcrumbs.Item>
      </Breadcrumbs>
      <ScrollableLayout>
        <section className="space-y-6 pt-6">
          <p className="px-6 text-sm uppercase tracking-[0.08em] sm:px-8">Available projects</p>
          {actionData?.error ? <p className="text-base leading-6">{actionData.error}</p> : null}
          {projects.length ? (
            <ul className="border-t-2 border-black">
              {projects.map((project) => (
                <ProjectRow key={project.id} project={project} />
              ))}
            </ul>
          ) : (
            <p className="text-base leading-6">No projects exist yet.</p>
          )}
        </section>
      </ScrollableLayout>
    </>
  );
}
