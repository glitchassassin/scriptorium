import { describe, expect, it } from "vitest";

import type { PendingEnrollment } from "~/lib/auth/types";

import { getConfirmPasskeyDocumentTitle, isPendingEnrollmentAvailable } from "./+/confirm-passkey-state";

function createEnrollment(overrides: Partial<PendingEnrollment> = {}): PendingEnrollment {
  return {
    enrollmentId: "enrollment-1",
    passkeyId: "passkey-1",
    label: "Office Mac",
    status: "pending",
    createdAt: "2026-03-31T12:00:00.000Z",
    expiresAt: "2099-03-31T12:10:00.000Z",
    consumedAt: null,
    ...overrides,
  };
}

describe("confirm passkey titles", () => {
  it("uses the activation title while the enrollment is still valid", () => {
    const enrollment = createEnrollment();

    expect(isPendingEnrollmentAvailable(enrollment)).toBe(true);
    expect(getConfirmPasskeyDocumentTitle(enrollment)).toBe("Activate Office Mac | scriptorium");
  });

  it("falls back when the enrollment is unavailable", () => {
    expect(getConfirmPasskeyDocumentTitle(createEnrollment({ consumedAt: "2026-03-31T12:05:00.000Z" }))).toBe(
      "Passkey unavailable | scriptorium",
    );
    expect(getConfirmPasskeyDocumentTitle(createEnrollment({ expiresAt: "2000-03-31T12:10:00.000Z" }))).toBe(
      "Passkey unavailable | scriptorium",
    );
    expect(getConfirmPasskeyDocumentTitle(null)).toBe("Passkey unavailable | scriptorium");
  });
});
