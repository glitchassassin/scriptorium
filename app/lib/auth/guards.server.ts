import { redirect } from "react-router";

import { countActivePasskeys, getPasskeyById } from "~/lib/auth/passkeys.server";
import { getAuthenticatedSession } from "~/lib/auth/sessions.server";
import type { AuthState } from "~/lib/auth/types";

export async function getAuthState(request: Request): Promise<AuthState> {
  const activePasskeyCount = countActivePasskeys();
  const session = await getAuthenticatedSession(request);

  return {
    activePasskeyCount,
    isAuthenticated: session !== null,
    session,
  };
}

export async function requireAuthenticatedPasskey(request: Request) {
  const authState = await getAuthState(request);

  if (authState.activePasskeyCount === 0) {
    throw redirect("/register");
  }

  if (!authState.session) {
    throw redirect("/login");
  }

  const passkey = getPasskeyById(authState.session.passkeyId);

  if (!passkey || passkey.status !== "active") {
    throw redirect("/login");
  }

  return { authState, passkey };
}
