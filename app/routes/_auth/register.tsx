import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { AuthSection } from "~/components/auth/auth-shell";
import { StatusMessage } from "~/components/auth/auth-shell";
import { getDocumentTitle } from "~/lib/document-title";

import type { Route } from "./+types/register";
import { getFallbackDeviceLabel } from "./+/device-label";
import { registerPasskey } from "./+/webauthn.client";

export default function RegisterRoute({}: Route.ComponentProps) {
  const navigate = useNavigate();
  const fallbackLabel = useMemo(() => getFallbackDeviceLabel(), []);
  const [label, setLabel] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleRegister() {
    try {
      setPending(true);
      setMessage(null);

      const result = await registerPasskey(label.trim() || fallbackLabel);
      navigate(result.redirectTo);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Passkey registration failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthSection title="Register device" copy="">
      <title>{getDocumentTitle("register")}</title>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleRegister();
        }}
      >
        <label className="block space-y-3 py-1">
          <span className="text-sm uppercase tracking-[0.08em]">Device label</span>
          <input
            className="min-h-11 w-full bg-white px-0 py-2 text-base text-black focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-2"
            disabled={pending}
            name="label"
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Desktop, iPhone, Macbook..."
            value={label}
          />
        </label>
        <button
          className="inline-flex min-h-11 w-full items-center justify-center bg-black px-3 py-2 text-base text-white sm:w-auto"
          disabled={pending}
          type="submit"
        >
          {pending ? "Waiting for your device" : "Register passkey"}
        </button>
        <StatusMessage message={message} />
        <p className="text-sm leading-6">
          <Link className="underline underline-offset-4" to="/login">
            Login
          </Link>
        </p>
      </form>
    </AuthSection>
  );
}
