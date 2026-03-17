import { homedir } from "node:os";

import { useState } from "react";
import { Form, redirect } from "react-router";

import { ScrollableLayout } from "~/components/shell/scrollable-layout";
import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { createInstance } from "~/lib/instances/runtime.server";
import type { RouteHandle } from "~/lib/route-handle";
import { FileExplorer } from "~/routes/_rpc/files.browse";

import type { Route } from "./+types/instances.new";

export const handle = {
  title: "New instance",
} satisfies RouteHandle;

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuthenticatedPasskey(request);

  return {
    initialDirectory: process.env.SCRIPTORIUM_BROWSER_ROOT?.trim() || homedir(),
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

  const instance = await createInstance({ directory, name: name || null });

  return redirect(`/instances/${instance.id}`);
}

export default function NewInstanceRoute({ actionData, loaderData }: Route.ComponentProps) {
  const [currentPath, setCurrentPath] = useState(loaderData.initialDirectory);
  const placeholderName = currentPath.split("/").filter(Boolean).at(-1) || currentPath;

  return (
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
            initialPath={loaderData.initialDirectory}
            name="directory"
            onBrowsePathChange={setCurrentPath}
            route="/files/browse"
            selectionMode="directory"
          />
        </section>
      </ScrollableLayout>
    </Form>
  );
}
