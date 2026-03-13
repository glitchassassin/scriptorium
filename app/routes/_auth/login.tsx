import { Link, redirect, useNavigate } from "react-router";
import { useState } from "react";

import { AuthSection, StatusMessage } from "~/components/auth/auth-shell";
import { getAuthState, isPasskeyAuthRequired } from "~/lib/auth/guards.server";

import type { Route } from "./+types/login";
import { signInWithPasskey } from "./+/webauthn.client";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isPasskeyAuthRequired(request)) {
    return redirect("/");
  }

  const authState = await getAuthState(request);

  if (authState.activePasskeyCount === 0) {
    return redirect("/register");
  }

  if (authState.isAuthenticated) {
    return redirect("/");
  }

  return { activePasskeyCount: authState.activePasskeyCount };
}

export default function LoginRoute({}: Route.ComponentProps) {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSignIn() {
    try {
      setPending(true);
      setMessage(null);

      const result = await signInWithPasskey();
      navigate(result.redirectTo);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Passkey sign-in failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthSection title="Login" copy="">
      <div className="space-y-4">
        <button
          className="inline-flex min-h-11 w-full items-center justify-center bg-black px-3 py-2 text-base text-white sm:w-auto"
          disabled={pending}
          onClick={handleSignIn}
          type="button"
        >
          {pending ? "Waiting for your passkey" : "Continue with a passkey"}
        </button>
        <StatusMessage message={message} />
        <p className="text-sm leading-6">
          <Link className="underline underline-offset-4" to="/register">
            Register a new passkey
          </Link>
        </p>
      </div>
    </AuthSection>
  );
}
