import { data } from "react-router";
import { z } from "zod";

import { beginPasskeyAuthentication } from "~/routes/_auth/+/webauthn.server";

import type { Route } from "./+types/begin";

const beginLoginRequestSchema = z.object({}).strict();

export async function action({ request }: Route.ActionArgs) {
  try {
    beginLoginRequestSchema.parse(await request.json());
    const result = await beginPasskeyAuthentication(request);
    return data(result);
  } catch (error) {
    return data(
      { error: error instanceof Error ? error.message : "Passkey sign-in failed." },
      { status: 400 },
    );
  }
}
