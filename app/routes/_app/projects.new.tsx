import { useState } from "react";
import { Form, redirect } from "react-router";

import { Breadcrumbs } from "~/components/shell/breadcrumbs";
import { ScrollableLayout } from "~/components/shell/scrollable-layout";
import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { createProject } from "~/lib/projects/runtime.server";
import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleDefinition } from "~/lib/route-handle";
import { getRuntimeConfiguration } from "~/lib/runtime-config/cache.server";
import { FileExplorer } from "~/routes/_rpc/files.browse";

import type { Route } from "./+types/projects.new";

export const handle: RouteHandleDefinition<Route.ComponentProps> = defineRouteHandle<Route.ComponentProps>({
  title: [{ label: "Projects", to: "/projects" }, { label: "New project" }],
});

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuthenticatedPasskey(request);

  return {
    initialDirectory: getRuntimeConfiguration().config.workspace.browserRoot,
  };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuthenticatedPasskey(request);

  const formData = await request.formData();
  const name = String(formData.get("name") || "").trim();
  const directory = String(formData.get("directory") || "").trim();

  if (!directory) {
    return { error: "Choose a folder." };
  }

  const project = await createProject({ directory, name: name || null });

  return redirect(`/projects/${project.id}`);
}

export default function NewProjectRoute({ actionData, loaderData, matches }: Route.ComponentProps) {
  const [currentPath, setCurrentPath] = useState(loaderData.initialDirectory);
  const placeholderName = currentPath.split("/").filter(Boolean).at(-1) || currentPath;

  return (
    <>
      <Breadcrumbs depth={matches.length}>
        <Breadcrumbs.Item to="/projects">Projects</Breadcrumbs.Item>
        <Breadcrumbs.Item>New project</Breadcrumbs.Item>
      </Breadcrumbs>
      <Form className="flex min-h-0 flex-1 flex-col" method="post">
        <ScrollableLayout
          header={(
            <div className="grid min-h-11 w-full grid-cols-[minmax(0,1fr)_minmax(14rem,20rem)_auto] items-center gap-3">
              <p className="truncate text-base font-bold">{currentPath}</p>
              <label className="min-w-0">
                <span className="sr-only">Folder name</span>
                <input
                  className="min-h-11 w-full border-l-2 border-black px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-black"
                  name="name"
                  placeholder={placeholderName}
                  type="text"
                />
              </label>
              <button className="min-h-11 bg-black px-3 py-2 text-base text-white" type="submit">
                Create
              </button>
            </div>
          )}
        >
          <section className="space-y-6 pt-6">
            {actionData?.error ? <p className="text-base leading-6">{actionData.error}</p> : null}
            <FileExplorer
              baseDirectory={loaderData.initialDirectory}
              initialPath={loaderData.initialDirectory}
              name="directory"
              onBrowsePathChange={setCurrentPath}
              route="/files/browse"
              selectionMode="directory"
            />
          </section>
        </ScrollableLayout>
      </Form>
    </>
  );
}
