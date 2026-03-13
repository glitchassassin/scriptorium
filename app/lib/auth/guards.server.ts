import { redirect } from "react-router";

import { countActivePasskeys, getPasskeyById } from "~/lib/auth/passkeys.server";
import { getAuthenticatedSession } from "~/lib/auth/sessions.server";
import type { AuthState } from "~/lib/auth/types";

function getForwardedHeaderValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim();
}

function getRequestHostname(request: Request) {
  const forwardedHost = getForwardedHeaderValue(request.headers.get("x-forwarded-host"));

  if (forwardedHost) {
    return new URL(`http://${forwardedHost}`).hostname;
  }

  return new URL(request.url).hostname;
}

export function isPasskeyAuthRequired(request: Request) {
  const hostname = getRequestHostname(request);
  return hostname !== "localhost";
}

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

  if (!isPasskeyAuthRequired(request)) {
    return { authState, isLocalBypass: true as const, passkey: null };
  }

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

  return { authState, isLocalBypass: false as const, passkey };
}
