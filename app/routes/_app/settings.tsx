import { Link } from "react-router";

import { Breadcrumbs } from "~/components/shell/breadcrumbs";
import { ScrollableLayout } from "~/components/shell/scrollable-layout";
import { UnreadBadge } from "~/components/ui/unread-badge";
import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { getDocumentTitle } from "~/lib/document-title";
import { getSharedOpencodeRuntimeStatus } from "~/lib/opencode/shared-runtime.server";

import type { Route } from "./+types/settings";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuthenticatedPasskey(request);

  return {
    opencodeRestartRequired: (await getSharedOpencodeRuntimeStatus()).restartRequired,
  };
}

export default function SettingsRoute({ loaderData, matches }: Route.ComponentProps) {
  return (
    <>
      <title>{getDocumentTitle("Settings")}</title>
      <Breadcrumbs depth={matches.length}>
        <Breadcrumbs.Item>Settings</Breadcrumbs.Item>
      </Breadcrumbs>
      <ScrollableLayout>
        <section className="space-y-4 pt-6">
          <p className="px-6 text-sm uppercase tracking-[0.08em] sm:px-8">Sections</p>
          <Link
            className="flex min-h-11 items-start justify-between gap-3 border-l-4 border-black px-3 py-2 text-base font-bold"
            to="/settings/opencode"
          >
            <span className="block flex-1">
              <span className="block">OpenCode</span>
              <span className="block text-sm leading-6 opacity-60">
                Restart the shared OpenCode process and review how Scriptorium connects to it.
              </span>
            </span>
            {loaderData.opencodeRestartRequired ? <span className="pt-1"><UnreadBadge /></span> : null}
          </Link>
          <Link
            className="block min-h-11 border-l-4 border-black px-3 py-2 text-base font-bold"
            to="/settings/passkeys"
          >
            <span className="block">Passkeys</span>
            <span className="block text-sm leading-6 opacity-60">
              Review active passkeys and revoke devices that should no longer sign in.
            </span>
          </Link>
        </section>
      </ScrollableLayout>
    </>
  );
}
