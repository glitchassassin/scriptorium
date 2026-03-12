import { data } from "react-router";
import { z } from "zod";

import { beginPasskeyRegistration } from "~/routes/_auth/+/webauthn.server";

import type { Route } from "./+types/begin";

const beginRegisterRequestSchema = z.object({
  label: z.string().trim().min(1),
});

export async function action({ request }: Route.ActionArgs) {
  try {
    const payload = beginRegisterRequestSchema.parse(await request.json());
    const result = await beginPasskeyRegistration(request, payload.label);
    return data(result);
  } catch (error) {
    return data(
      { error: error instanceof Error ? error.message : "Passkey registration failed." },
      { status: 400 },
    );
  }
}
