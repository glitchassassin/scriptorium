export type PasskeyStatus = "pending" | "active" | "revoked";

export type PasskeyRecord = {
  id: string;
  webauthnUserId: string;
  publicKey: Uint8Array;
  counter: number;
  deviceType: string;
  backedUp: boolean;
  transports: string[];
  label: string;
  status: PasskeyStatus;
  createdAt: string;
  activatedAt: string | null;
  revokedAt: string | null;
};

export type SessionRecord = {
  id: string;
  passkeyId: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
};

export type AuthState = {
  activePasskeyCount: number;
  isAuthenticated: boolean;
  session: SessionRecord | null;
};

export type PendingEnrollment = {
  enrollmentId: string;
  passkeyId: string;
  label: string;
  expiresAt: string;
  createdAt: string;
  consumedAt: string | null;
  status: PasskeyStatus;
};
