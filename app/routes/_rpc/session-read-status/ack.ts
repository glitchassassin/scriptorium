import { data } from "react-router";

import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { markSessionRead } from "~/lib/session-read-status.server";

import type { Route } from "./+types/ack";

export function shouldRevalidate() {
  return false;
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuthenticatedPasskey(request);
  const formData = await request.formData();
  const sessionId = String(formData.get("sessionId") ?? "").trim();

  if (!sessionId) {
    return data({ ok: false }, { status: 400 });
  }

  markSessionRead({ sessionId });

  return data({ ok: true });
}
