import { Link } from "react-router";

import type { RouteHandle } from "~/lib/route-handle";

export const handle = {
  title: "Settings",
} satisfies RouteHandle;

export default function SettingsRoute() {
  return (
    <section className="space-y-4">
      <p className="text-sm uppercase tracking-[0.08em]">Sections</p>
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
  );
}
