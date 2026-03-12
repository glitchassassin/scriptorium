// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createPendingPasskey, activatePasskey } from "~/lib/auth/passkeys.server";
import { createAuthenticatedSession, destroyAuthenticatedSession, getAuthenticatedSession } from "~/lib/auth/sessions.server";
import { withTestDatabase } from "~/lib/db.server";

describe("sessions", () => {
  it("creates and destroys a cookie-backed session", async () => {
    await withTestDatabase(async () => {
      createPendingPasskey({
        id: "credential-2",
        webauthnUserId: "admin",
        publicKey: new Uint8Array([4, 5, 6]),
        counter: 0,
        deviceType: "singleDevice",
        backedUp: true,
        transports: ["internal"],
        label: "Travel phone",
      });
      activatePasskey("credential-2");

      const cookie = await createAuthenticatedSession("credential-2");
      const request = new Request("http://localhost/", { headers: { Cookie: cookie } });

      const session = await getAuthenticatedSession(request);
      expect(session?.passkeyId).toBe("credential-2");

      const expiredCookie = await destroyAuthenticatedSession(request);
      const loggedOutRequest = new Request("http://localhost/", {
        headers: { Cookie: expiredCookie },
      });

      expect(await getAuthenticatedSession(loggedOutRequest)).toBeNull();
    });
  });
});
