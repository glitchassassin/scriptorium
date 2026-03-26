import { data, Link, useFetcher } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import { ScrollableLayout } from "~/components/shell/scrollable-layout";
import { Breadcrumbs } from "~/components/shell/breadcrumbs";
import { useDoubleCheck } from "~/hooks/use-double-check";
import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { listInstances, removeInstance } from "~/lib/instances/runtime.server";
import type { InstanceRecord } from "~/lib/instances/types";
import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleDefinition } from "~/lib/route-handle";
import { getServerTimingHeaders, makeTimings, time } from "~/lib/server-timing.server";

import type { Route } from "./+types/instances";

export const handle: RouteHandleDefinition<Route.ComponentProps> = defineRouteHandle<Route.ComponentProps>({
  title: [{ label: "Instances" }],
  iconNavActions: [
    {
      icon: "mdi:plus",
      label: "New instance",
      to: "/instances/new",
      end: true,
    },
  ],
});

export async function loader({ request }: Route.LoaderArgs) {
  const timings = makeTimings("instances loader");

  await time(() => requireAuthenticatedPasskey(request), {
    desc: "require authenticated passkey",
    timings,
    type: "auth",
  });

  return data(
    {
      instances: await time(() => listInstances(), {
        desc: "list instances",
        timings,
        type: "instances",
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
  const instanceId = String(formData.get("instanceId") || "").trim();

  if (intent !== "delete" || !instanceId) {
    return data({ error: "That action is not supported." }, { status: 400 });
  }

  await removeInstance(instanceId);

  return data({ error: null });
}

function InstanceRow({ instance }: { instance: InstanceRecord }) {
  const fetcher = useFetcher<typeof action>();
  const { doubleCheck, getButtonProps } = useDoubleCheck();
  const isDeleting = fetcher.state !== "idle";
  const icon = doubleCheck ? "mdi:help" : "mdi:trash-can-outline";
  const label = doubleCheck ? `Confirm delete ${instance.name}` : `Delete ${instance.name}`;

  return (
    <li className="grid gap-3 border-b-2 border-black px-3 py-3 md:grid-cols-[1fr_auto] md:items-center">
      <Link className="block min-w-0 space-y-1" to={`/instances/${instance.id}`}>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="truncate text-lg font-bold">{instance.name}</p>
          <span className="text-sm leading-6 opacity-60">{instance.status}</span>
        </div>
        <p className="truncate text-sm leading-6">{instance.directory}</p>
      </Link>
      <div className="flex items-center justify-between gap-3 md:justify-end">
        <fetcher.Form method="post">
          <input name="intent" type="hidden" value="delete" />
          <input name="instanceId" type="hidden" value={instance.id} />
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

export default function InstancesRoute({ actionData, loaderData, matches }: Route.ComponentProps) {
  return (
    <>
      <Breadcrumbs depth={matches.length}>
        <Breadcrumbs.Item>Instances</Breadcrumbs.Item>
      </Breadcrumbs>
      <ScrollableLayout>
        <section className="space-y-6 pt-6">
          <p className="px-6 text-sm uppercase tracking-[0.08em] sm:px-8">Running workspaces</p>
          {actionData?.error ? <p className="text-base leading-6">{actionData.error}</p> : null}
          {loaderData.instances.length ? (
            <ul className="border-t-2 border-black">
              {loaderData.instances.map((instance: InstanceRecord) => (
                <InstanceRow instance={instance} key={instance.id} />
              ))}
            </ul>
          ) : (
            <p className="text-base leading-6">No instances exist yet.</p>
          )}
        </section>
      </ScrollableLayout>
    </>
  );
}
