import type { PendingEnrollment } from "~/lib/auth/types";
import { getDocumentTitle } from "~/lib/document-title";

export function isPendingEnrollmentAvailable(enrollment: PendingEnrollment | null | undefined): enrollment is PendingEnrollment {
  const expired = enrollment && enrollment.expiresAt <= new Date().toISOString();

  return Boolean(enrollment && enrollment.status === "pending" && !enrollment.consumedAt && !expired);
}

export function getConfirmPasskeyDocumentTitle(enrollment: PendingEnrollment | null | undefined) {
  return isPendingEnrollmentAvailable(enrollment)
    ? getDocumentTitle(`Activate ${enrollment.label}`)
    : getDocumentTitle("Passkey unavailable");
}
