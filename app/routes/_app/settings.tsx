import { Link } from "react-router";

import { Breadcrumbs } from "~/components/shell/breadcrumbs";
import { ScrollableLayout } from "~/components/shell/scrollable-layout";
import { getDocumentTitle } from "~/lib/document-title";

import type { Route } from "./+types/settings";

export default function SettingsRoute({ matches }: Route.ComponentProps) {
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
