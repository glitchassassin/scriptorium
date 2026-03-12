import { data } from "react-router";
import { z } from "zod";

import type { AuthenticationResponseJSON } from "@simplewebauthn/server";

import { createAuthenticatedSession } from "~/lib/auth/sessions.server";
import { finishPasskeyAuthentication } from "~/routes/_auth/+/webauthn.server";

import type { Route } from "./+types/finish";

const authenticationCredentialSchema = z
  .object({
    id: z.string().min(1),
    rawId: z.string().min(1),
    type: z.literal("public-key"),
    response: z
      .object({
        clientDataJSON: z.string().min(1),
        authenticatorData: z.string().min(1),
        signature: z.string().min(1),
        userHandle: z.string().nullable().optional(),
      })
      .passthrough(),
    clientExtensionResults: z.record(z.string(), z.unknown()).optional(),
    authenticatorAttachment: z.string().optional(),
  })
  .passthrough();

const finishLoginRequestSchema = z.object({
  flowId: z.string().trim().min(1),
  credential: authenticationCredentialSchema,
});

export async function action({ request }: Route.ActionArgs) {
  try {
    const payload = finishLoginRequestSchema.parse(await request.json());
    const passkey = await finishPasskeyAuthentication(
      request,
      payload.flowId,
      payload.credential as AuthenticationResponseJSON,
    );
    const setCookie = await createAuthenticatedSession(passkey.id);

    return data(
      { redirectTo: "/" },
      { headers: { "Set-Cookie": setCookie } },
    );
  } catch (error) {
    return data(
      { error: error instanceof Error ? error.message : "Passkey sign-in failed." },
      { status: 400 },
    );
  }
}
