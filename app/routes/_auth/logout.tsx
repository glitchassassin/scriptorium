import { redirect } from "react-router";

import { countActivePasskeys } from "~/lib/auth/passkeys.server";
import { destroyAuthenticatedSession } from "~/lib/auth/sessions.server";

import type { Route } from "./+types/logout";

export async function loader() {
  return redirect("/login");
}

export async function action({ request }: Route.ActionArgs) {
  const setCookie = await destroyAuthenticatedSession(request);
  const location = countActivePasskeys() > 0 ? "/login" : "/register";

  return redirect(location, {
    headers: { "Set-Cookie": setCookie },
  });
}
