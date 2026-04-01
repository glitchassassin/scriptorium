import { data, redirect, useFetcher } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import { Breadcrumbs } from "~/components/shell/breadcrumbs";
import { ScrollableLayout } from "~/components/shell/scrollable-layout";
import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { countActivePasskeys, getPasskeyById, listActivePasskeys, revokePasskey } from "~/lib/auth/passkeys.server";
import { useDoubleCheck } from "~/hooks/use-double-check";
import { destroyAuthenticatedSession, destroySessionsForPasskey } from "~/lib/auth/sessions.server";
import { getDocumentTitle } from "~/lib/document-title";
import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleDefinition } from "~/lib/route-handle";

import type { Route } from "./+types/passkeys";

export const handle: RouteHandleDefinition<Route.ComponentProps> = defineRouteHandle<Route.ComponentProps>({
  iconNavActions: [
    {
      icon: "mdi:arrow-left",
      label: "Back to settings",
      to: "/settings",
      end: true,
    },
  ],
});

export async function loader({ request }: Route.LoaderArgs) {
  const { passkey } = await requireAuthenticatedPasskey(request);

  return {
    currentPasskeyId: passkey?.id || null,
    passkeys: listActivePasskeys(),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { isLocalBypass, passkey: currentPasskey } = await requireAuthenticatedPasskey(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "").trim();
  const passkeyId = String(formData.get("passkeyId") || "").trim();

  if (intent !== "revoke") {
    return data({ error: "That action is not supported." }, { status: 400 });
  }

  if (!passkeyId) {
    return data({ error: "Choose a passkey to revoke." }, { status: 400 });
  }

  const targetPasskey = getPasskeyById(passkeyId);

  if (!targetPasskey || targetPasskey.status !== "active") {
    return data({ error: "That passkey is no longer active." }, { status: 404 });
  }

  revokePasskey(passkeyId);
  destroySessionsForPasskey(passkeyId);

  if (!isLocalBypass && (passkeyId === currentPasskey?.id || countActivePasskeys() === 0)) {
    const setCookie = await destroyAuthenticatedSession(request);

    return redirect("/register", {
      headers: { "Set-Cookie": setCookie },
    });
  }

  return data({ error: null });
}

function PasskeyRow({
  currentPasskeyId,
  passkey,
}: {
  currentPasskeyId: string | null;
  passkey: Route.ComponentProps["loaderData"]["passkeys"][number];
}) {
  const fetcher = useFetcher<typeof action>();
  const { doubleCheck, getButtonProps } = useDoubleCheck();
  const isCurrent = passkey.id === currentPasskeyId;
  const isSubmitting = fetcher.state !== "idle";
  const icon = doubleCheck ? "mdi:help" : "mdi:trash-can-outline";
  const label = doubleCheck ? `Confirm revoke ${passkey.label}` : `Revoke ${passkey.label}`;

  return (
    <li className="flex min-h-11 items-center justify-between gap-3 border-b-2 border-black px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-flex min-h-11 min-w-11 items-center justify-center" aria-hidden="true">
          {isCurrent ? <Icon className="size-6" icon="mdi:star" /> : null}
        </span>
        <span className="truncate text-base">{passkey.label}</span>
      </div>
      <fetcher.Form method="post">
        <input name="intent" type="hidden" value="revoke" />
        <input name="passkeyId" type="hidden" value={passkey.id} />
        <button
          aria-label={label}
          className="inline-flex min-h-11 min-w-11 items-center justify-center disabled:opacity-25"
          disabled={isSubmitting}
          type="submit"
          {...getButtonProps()}
        >
          <Icon className="size-6" icon={icon} />
        </button>
      </fetcher.Form>
      {fetcher.data?.error ? <p className="sr-only">{fetcher.data.error}</p> : null}
    </li>
  );
}

export default function SettingsPasskeysRoute({ actionData, loaderData, matches }: Route.ComponentProps) {
  return (
    <>
      <title>{getDocumentTitle("Passkeys", "Settings")}</title>
      <Breadcrumbs depth={matches.length}>
        <Breadcrumbs.Item to="/settings">Settings</Breadcrumbs.Item>
        <Breadcrumbs.Item>Passkeys</Breadcrumbs.Item>
      </Breadcrumbs>
      <ScrollableLayout>
        <section className="space-y-6 pt-6">
          <div className="space-y-2 px-6 sm:px-8">
            <p className="text-sm uppercase tracking-[0.08em]">Active devices</p>
            <p className="text-base leading-6">
              Revoke any passkey that should stop signing in. Revoking the device you are using will send you back through registration.
            </p>
          </div>
          {actionData?.error ? (
            <p className="border-t-2 border-black pt-3 text-base leading-6">{actionData.error}</p>
          ) : null}
          <ul className="border-t-2 border-black">
            {loaderData.passkeys.map((passkey) => (
              <PasskeyRow
                currentPasskeyId={loaderData.currentPasskeyId}
                key={passkey.id}
                passkey={passkey}
              />
            ))}
          </ul>
        </section>
      </ScrollableLayout>
    </>
  );
}
