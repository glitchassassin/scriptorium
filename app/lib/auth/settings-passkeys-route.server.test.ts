// @vitest-environment node

import { describe, expect, it } from "vitest";

import { action } from "~/routes/_app/settings/passkeys";
import { activatePasskey, createPendingPasskey, listActivePasskeys } from "~/lib/auth/passkeys.server";
import { createAuthenticatedSession, getAuthenticatedSession } from "~/lib/auth/sessions.server";
import { withTestDatabase } from "~/lib/db.server";

function createActivePasskey(id: string, label: string) {
  createPendingPasskey({
    id,
    webauthnUserId: "admin",
    publicKey: new Uint8Array([1, 2, 3]),
    counter: 0,
    deviceType: "singleDevice",
    backedUp: true,
    transports: ["internal"],
    label,
  });

  activatePasskey(id);
}

function createPostRequest(cookie: string, passkeyId: string) {
  return new Request("http://localhost/settings/passkeys", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookie,
    },
    body: new URLSearchParams({
      intent: "revoke",
      passkeyId,
    }),
  });
}

describe("settings passkeys route", () => {
  it("redirects to registration when the current passkey is revoked", async () => {
    await withTestDatabase(async () => {
      createActivePasskey("credential-1", "Desk laptop");

      const cookie = await createAuthenticatedSession("credential-1");
      const response = await action({
        context: {},
        params: {},
        request: createPostRequest(cookie, "credential-1"),
      } as never);

      expect(response).toBeInstanceOf(Response);

      if (!(response instanceof Response)) {
        throw new Error("Expected redirect response");
      }

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/register");
      expect(listActivePasskeys()).toHaveLength(0);

      const session = await getAuthenticatedSession(
        new Request("http://localhost/", {
          headers: {
            Cookie: response.headers.get("Set-Cookie") || "",
          },
        }),
      );

      expect(session).toBeNull();
    });
  });

  it("keeps the current session when revoking another passkey", async () => {
    await withTestDatabase(async () => {
      createActivePasskey("credential-1", "Desk laptop");
      createActivePasskey("credential-2", "Travel phone");

      const cookie = await createAuthenticatedSession("credential-1");
      const response = await action({
        context: {},
        params: {},
        request: createPostRequest(cookie, "credential-2"),
      } as never);

      expect(response).not.toBeInstanceOf(Response);
      expect(listActivePasskeys().map((passkey) => passkey.id)).toEqual(["credential-1"]);
      expect(
        await getAuthenticatedSession(
          new Request("http://localhost/", { headers: { Cookie: cookie } }),
        ),
      ).not.toBeNull();
    });
  });
});
