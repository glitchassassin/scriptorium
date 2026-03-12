import { data, Form, Link, redirect, useActionData } from "react-router";

import { AuthSection, StatusMessage } from "~/components/auth/auth-shell";
import { consumeActivationCode, getPendingEnrollment } from "~/lib/auth/activation-codes.server";
import { activatePasskey } from "~/lib/auth/passkeys.server";
import { createAuthenticatedSession } from "~/lib/auth/sessions.server";

import type { Route } from "./+types/confirm-passkey";

export async function loader({ request }: Route.LoaderArgs) {
  const enrollmentId = new URL(request.url).searchParams.get("enrollment")?.trim() || "";

  return {
    enrollmentId,
    enrollment: enrollmentId ? getPendingEnrollment(enrollmentId) : null,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const enrollmentId = String(formData.get("enrollmentId") || "").trim();
  const code = String(formData.get("code") || "").trim();

  if (!enrollmentId) {
    return data({ error: "That enrollment is missing." }, { status: 400 });
  }

  try {
    const passkeyId = consumeActivationCode(enrollmentId, code);
    const passkey = activatePasskey(passkeyId);

    if (!passkey) {
      throw new Error("That pending passkey could not be activated.");
    }

    const setCookie = await createAuthenticatedSession(passkey.id);

    return redirect("/", {
      headers: { "Set-Cookie": setCookie },
    });
  } catch (error) {
    return data(
      { error: error instanceof Error ? error.message : "Confirmation failed." },
      { status: 400 },
    );
  }
}

export default function ConfirmPasskeyRoute({ loaderData }: Route.ComponentProps) {
  const latestActionData = useActionData() as { error?: string } | undefined;
  const enrollment = loaderData.enrollment;
  const expired = enrollment && enrollment.expiresAt <= new Date().toISOString();

  if (!enrollment || enrollment.status !== "pending" || enrollment.consumedAt || expired) {
    return (
      <AuthSection
        title="That enrollment is no longer available"
        copy="Pending registrations are intentionally short-lived. Start again from registration and use the newest console code."
        footer={<Link className="underline underline-offset-4" to="/register">Register a passkey</Link>}
      >
        <StatusMessage message={null} />
      </AuthSection>
    );
  }

  return (
    <AuthSection
      title={`Activate ${enrollment.label}`}
      copy="Check the server console for the one-time confirmation code (expires in 10 minutes)."
    >
      <Form className="space-y-4" method="post">
        <input name="enrollmentId" type="hidden" value={loaderData.enrollmentId} />
        <label className="block space-y-2">
          <span className="text-sm uppercase tracking-[0.08em]">Confirmation code</span>
          <input
            autoComplete="one-time-code"
            className="min-h-11 w-full bg-white px-0 py-2 font-mono text-base uppercase tracking-[0.12em] text-black focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-2"
            name="code"
            placeholder="AB12-CD34"
            required
          />
        </label>
        <button className="inline-flex min-h-11 w-full items-center justify-center bg-black px-3 py-2 text-base text-white sm:w-auto" type="submit">
          Activate passkey
        </button>
      </Form>
      <StatusMessage message={latestActionData?.error ?? null} />
    </AuthSection>
  );
}
