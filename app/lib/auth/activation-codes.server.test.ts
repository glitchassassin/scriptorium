// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createActivationCode, consumeActivationCode, getPendingEnrollment } from "~/lib/auth/activation-codes.server";
import { createPendingPasskey } from "~/lib/auth/passkeys.server";
import { withTestDatabase } from "~/lib/db.server";

describe("activation codes", () => {
  it("creates a pending enrollment and consumes a code once", async () => {
    await withTestDatabase(() => {
      createPendingPasskey({
        id: "credential-1",
        webauthnUserId: "admin",
        publicKey: new Uint8Array([1, 2, 3]),
        counter: 0,
        deviceType: "singleDevice",
        backedUp: false,
        transports: ["internal"],
        label: "Desk laptop",
      });

      const activation = createActivationCode("credential-1");
      const pending = getPendingEnrollment(activation.enrollmentId);

      expect(pending?.label).toBe("Desk laptop");
      expect(consumeActivationCode(activation.enrollmentId, activation.code)).toBe("credential-1");
      expect(() => consumeActivationCode(activation.enrollmentId, activation.code)).toThrow(
        /already been used/i,
      );
    });
  });

  it("rejects the wrong code", async () => {
    await withTestDatabase(() => {
      createPendingPasskey({
        id: "credential-1",
        webauthnUserId: "admin",
        publicKey: new Uint8Array([1, 2, 3]),
        counter: 0,
        deviceType: "singleDevice",
        backedUp: false,
        transports: ["internal"],
        label: "Desk laptop",
      });

      const activation = createActivationCode("credential-1");

      expect(() => consumeActivationCode(activation.enrollmentId, "WRNG-CODE")).toThrow(
        /not recognized/i,
      );
    });
  });
});
