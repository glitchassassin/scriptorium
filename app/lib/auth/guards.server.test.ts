// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const countActivePasskeysMock = vi.fn();
const getPasskeyByIdMock = vi.fn();
const getAuthenticatedSessionMock = vi.fn();

vi.mock("~/lib/auth/passkeys.server", () => ({
  countActivePasskeys: (...args: unknown[]) => countActivePasskeysMock(...args),
  getPasskeyById: (...args: unknown[]) => getPasskeyByIdMock(...args),
}));

vi.mock("~/lib/auth/sessions.server", () => ({
  getAuthenticatedSession: (...args: unknown[]) => getAuthenticatedSessionMock(...args),
}));

import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";

describe("requireAuthenticatedPasskey", () => {
  beforeEach(() => {
    countActivePasskeysMock.mockReset();
    getPasskeyByIdMock.mockReset();
    getAuthenticatedSessionMock.mockReset();
  });

  it("bypasses auth on localhost without hitting auth storage", async () => {
    await expect(requireAuthenticatedPasskey(new Request("http://localhost/settings"))).resolves.toEqual({
      authState: {
        activePasskeyCount: 0,
        isAuthenticated: false,
        session: null,
      },
      isLocalBypass: true,
      passkey: null,
    });

    expect(countActivePasskeysMock).not.toHaveBeenCalled();
    expect(getAuthenticatedSessionMock).not.toHaveBeenCalled();
    expect(getPasskeyByIdMock).not.toHaveBeenCalled();
  });

  it("bypasses auth on IPv6 localhost without hitting auth storage", async () => {
    await expect(requireAuthenticatedPasskey(new Request("http://[::1]:5174/settings"))).resolves.toEqual({
      authState: {
        activePasskeyCount: 0,
        isAuthenticated: false,
        session: null,
      },
      isLocalBypass: true,
      passkey: null,
    });

    expect(countActivePasskeysMock).not.toHaveBeenCalled();
    expect(getAuthenticatedSessionMock).not.toHaveBeenCalled();
    expect(getPasskeyByIdMock).not.toHaveBeenCalled();
  });
});
