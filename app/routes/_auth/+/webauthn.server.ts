import { randomBytes } from "node:crypto";

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { eq } from "drizzle-orm";

import {
  createActivationCode,
  getActivationCodeTimeToLiveMs,
} from "~/lib/auth/activation-codes.server";
import {
  createPendingPasskey,
  getPasskeyByCredentialId,
  listActivePasskeys,
  listNonRevokedPasskeys,
  updatePasskeyCounter,
} from "~/lib/auth/passkeys.server";
import { getOrm } from "~/lib/db.server";
import {
  authenticationChallenges,
  registrationChallenges,
} from "~/lib/db/schema";

const REGISTRATION_TTL_MS = 5 * 60 * 1000;
const AUTHENTICATION_TTL_MS = 5 * 60 * 1000;
const APP_USER_ID = Uint8Array.from(Buffer.from("scriptorium-admin"));
const APP_USER_NAME = "Scriptorium";

function toArrayBufferUint8Array(value: Uint8Array) {
  return Uint8Array.from(value);
}

function getRelyingParty(request: Request) {
  const url = new URL(request.url);

  return {
    expectedOrigin: url.origin,
    expectedRPID: url.hostname,
    rpID: url.hostname,
    rpName: "Scriptorium",
  };
}

export async function beginPasskeyRegistration(request: Request, label: string) {
  const db = getOrm();
  const { rpID, rpName } = getRelyingParty(request);
  const flowId = randomBytes(16).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REGISTRATION_TTL_MS).toISOString();
  const existingPasskeys = listNonRevokedPasskeys();

  const options = await generateRegistrationOptions({
    rpID,
    rpName,
    attestationType: "none",
    userID: APP_USER_ID,
    userName: APP_USER_NAME,
    userDisplayName: APP_USER_NAME,
    excludeCredentials: existingPasskeys.map((passkey) => ({
      id: passkey.id,
      transports: passkey.transports as never,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    supportedAlgorithmIDs: [-7, -257],
  });

  db
    .insert(registrationChallenges)
    .values({
      id: flowId,
      challenge: options.challenge,
      label,
      expiresAt,
      createdAt: now.toISOString(),
    })
    .run();

  return { flowId, options };
}

export async function finishPasskeyRegistration(
  request: Request,
  flowId: string,
  credential: RegistrationResponseJSON,
) {
  const db = getOrm();
  const now = new Date().toISOString();
  const challengeRow = db
    .select()
    .from(registrationChallenges)
    .where(eq(registrationChallenges.id, flowId))
    .get();

  if (!challengeRow || challengeRow.expiresAt <= now) {
    throw new Error("This registration request has expired. Start again.");
  }

  const { expectedOrigin, expectedRPID } = getRelyingParty(request);

  const verification = await verifyRegistrationResponse({
    response: credential,
    expectedChallenge: challengeRow.challenge,
    expectedOrigin,
    expectedRPID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Passkey registration could not be verified.");
  }

  const {
    credential: registrationCredential,
    credentialBackedUp,
    credentialDeviceType,
  } = verification.registrationInfo;
  const existingPasskey = getPasskeyByCredentialId(registrationCredential.id);

  if (existingPasskey && existingPasskey.status !== "revoked") {
    throw new Error("That passkey is already registered.");
  }

  createPendingPasskey({
    id: registrationCredential.id,
    webauthnUserId: Buffer.from(APP_USER_ID).toString("base64url"),
    publicKey: registrationCredential.publicKey,
    counter: registrationCredential.counter,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    transports: registrationCredential.transports ?? [],
    label: challengeRow.label,
  });

  const activation = createActivationCode(registrationCredential.id);
  const expiresInMinutes = Math.floor(getActivationCodeTimeToLiveMs() / 60000);

  console.log(
    `[scriptorium] confirm passkey "${challengeRow.label}" with code ${activation.code} within ${expiresInMinutes} minutes`,
  );

  db.delete(registrationChallenges).where(eq(registrationChallenges.id, flowId)).run();

  return {
    enrollmentId: activation.enrollmentId,
    label: challengeRow.label,
  };
}

export async function beginPasskeyAuthentication(request: Request) {
  const db = getOrm();
  const { rpID } = getRelyingParty(request);
  const flowId = randomBytes(16).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + AUTHENTICATION_TTL_MS).toISOString();
  const activePasskeys = listActivePasskeys();

  if (activePasskeys.length === 0) {
    throw new Error("No active passkeys are available yet.");
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: activePasskeys.map((passkey) => ({
      id: passkey.id,
      transports: passkey.transports as never,
    })),
    userVerification: "preferred",
  });

  db
    .insert(authenticationChallenges)
    .values({
      id: flowId,
      challenge: options.challenge,
      expiresAt,
      createdAt: now.toISOString(),
    })
    .run();

  return { flowId, options };
}

export async function finishPasskeyAuthentication(
  request: Request,
  flowId: string,
  credential: AuthenticationResponseJSON,
) {
  const db = getOrm();
  const now = new Date().toISOString();
  const challengeRow = db
    .select()
    .from(authenticationChallenges)
    .where(eq(authenticationChallenges.id, flowId))
    .get();

  if (!challengeRow || challengeRow.expiresAt <= now) {
    throw new Error("This sign-in request has expired. Try again.");
  }

  const passkey = getPasskeyByCredentialId(credential.id);

  if (!passkey || passkey.status !== "active") {
    throw new Error("That passkey is not active.");
  }

  const { expectedOrigin, expectedRPID } = getRelyingParty(request);
  const verification = await verifyAuthenticationResponse({
    response: credential,
    expectedChallenge: challengeRow.challenge,
    expectedOrigin,
    expectedRPID,
    credential: {
      id: passkey.id,
      publicKey: toArrayBufferUint8Array(passkey.publicKey),
      counter: passkey.counter,
      transports: passkey.transports as never,
    },
  });

  if (!verification.verified) {
    throw new Error("Passkey sign-in could not be verified.");
  }

  updatePasskeyCounter(passkey.id, verification.authenticationInfo.newCounter);
  db.delete(authenticationChallenges).where(eq(authenticationChallenges.id, flowId)).run();

  return passkey;
}
