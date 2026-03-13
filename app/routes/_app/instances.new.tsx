import { homedir } from "node:os";

import { redirect } from "react-router";

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
  return (
    <ScrollableLayout>
      <section className="space-y-6">
        <p className="text-sm uppercase tracking-[0.08em]">Create instance</p>
        {actionData?.error ? <p className="text-base leading-6">{actionData.error}</p> : null}
        <form className="space-y-6" method="post">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block min-w-0 flex-1 space-y-2">
              <span className="block text-sm uppercase tracking-[0.08em]">Name</span>
              <input
                className="min-h-11 w-full border-l-2 border-black px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-black"
                name="name"
                placeholder="Defaults to the folder name"
                type="text"
              />
            </label>
            <button className="min-h-11 bg-black px-3 py-2 text-base text-white" type="submit">
              Create instance
            </button>
          </div>
          <FileExplorer
            initialPath={loaderData.initialDirectory}
            label="Working Directory"
            name="directory"
            route="/files/browse"
            selectionMode="directory"
          />
        </form>
      </section>
    </ScrollableLayout>
  );
}
