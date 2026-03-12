import { data } from "react-router";
import { z } from "zod";

import type { RegistrationResponseJSON } from "@simplewebauthn/server";

import { finishPasskeyRegistration } from "~/routes/_auth/+/webauthn.server";

import type { Route } from "./+types/finish";

const registrationCredentialSchema = z
  .object({
    id: z.string().min(1),
    rawId: z.string().min(1),
    type: z.literal("public-key"),
    response: z
      .object({
        clientDataJSON: z.string().min(1),
        attestationObject: z.string().min(1),
        transports: z.array(z.string()).optional(),
        publicKeyAlgorithm: z.number().optional(),
        publicKey: z.string().optional(),
        authenticatorData: z.string().optional(),
      })
      .passthrough(),
    clientExtensionResults: z.record(z.string(), z.unknown()).optional(),
    authenticatorAttachment: z.string().optional(),
  })
  .passthrough();

const finishRegisterRequestSchema = z.object({
  flowId: z.string().trim().min(1),
  credential: registrationCredentialSchema,
});

export async function action({ request }: Route.ActionArgs) {
  try {
    const payload = finishRegisterRequestSchema.parse(await request.json());
    const { flowId, credential } = payload;
    const result = await finishPasskeyRegistration(
      request,
      flowId,
      credential as RegistrationResponseJSON,
    );

    return data({ redirectTo: `/confirm-passkey?enrollment=${result.enrollmentId}` });
  } catch (error) {
    return data(
      { error: error instanceof Error ? error.message : "Passkey registration failed." },
      { status: 400 },
    );
  }
}
