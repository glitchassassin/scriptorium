import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

function getErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return "Something went wrong. Please try again.";
}

async function postJson<T>(url: string, payload: unknown) {
  const response = await fetch(url, {
    method: "post",
    body: JSON.stringify(payload),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
  });

  const responsePayload = (await response.json()) as T | { error?: string };

  if (!response.ok) {
    throw new Error(getErrorMessage(responsePayload));
  }

  return responsePayload as T;
}

export async function registerPasskey(label: string) {
  const beginResult = await postJson<{
    flowId: string;
    options: Parameters<typeof startRegistration>[0]["optionsJSON"];
  }>("/auth/register/begin", { label });

  const credential = await startRegistration({ optionsJSON: beginResult.options });

  return postJson<{ redirectTo: string }>("/auth/register/finish", {
    flowId: beginResult.flowId,
    credential,
  });
}

export async function signInWithPasskey() {
  const begin = await postJson<{
    flowId: string;
    options: Parameters<typeof startAuthentication>[0]["optionsJSON"];
  }>("/auth/login/begin", {});

  const credential = await startAuthentication({ optionsJSON: begin.options });

  return postJson<{ redirectTo: string }>("/auth/login/finish", {
    flowId: begin.flowId,
    credential,
  });
}
