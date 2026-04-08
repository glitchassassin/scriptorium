// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthenticatedPasskeyMock = vi.fn();
const getSharedOpencodeRuntimeStatusMock = vi.fn();
const restartSharedOpencodeServerMock = vi.fn();
const startSharedOpencodeServerMock = vi.fn();
const updateSharedOpencodeServerMock = vi.fn();

vi.mock("~/lib/auth/guards.server", () => ({
  requireAuthenticatedPasskey: (...args: unknown[]) => requireAuthenticatedPasskeyMock(...args),
}));

vi.mock("~/lib/opencode/shared-runtime.server", () => ({
  getSharedOpencodeRuntimeStatus: (...args: unknown[]) => getSharedOpencodeRuntimeStatusMock(...args),
  restartSharedOpencodeServer: (...args: unknown[]) => restartSharedOpencodeServerMock(...args),
  startSharedOpencodeServer: (...args: unknown[]) => startSharedOpencodeServerMock(...args),
  updateSharedOpencodeServer: (...args: unknown[]) => updateSharedOpencodeServerMock(...args),
}));

import { action, loader } from "~/routes/_app/settings/opencode";

function createPostRequest(intent = "restart") {
  return new Request("http://scriptorium.test/settings/opencode", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ intent }),
  });
}

describe("settings OpenCode route", () => {
  beforeEach(() => {
    requireAuthenticatedPasskeyMock.mockReset();
    getSharedOpencodeRuntimeStatusMock.mockReset();
    restartSharedOpencodeServerMock.mockReset();
    startSharedOpencodeServerMock.mockReset();
    updateSharedOpencodeServerMock.mockReset();

    requireAuthenticatedPasskeyMock.mockResolvedValue(undefined);
    getSharedOpencodeRuntimeStatusMock.mockResolvedValue({
      activeSince: 1_000_000,
      error: null,
      installedVersion: "1.4.0",
      isRunning: true,
      mode: "managed",
      restartRequired: false,
      runningVersion: "1.4.0",
      serverUrl: "http://127.0.0.1:4100",
    });
    restartSharedOpencodeServerMock.mockResolvedValue("http://127.0.0.1:4200");
    startSharedOpencodeServerMock.mockResolvedValue("http://127.0.0.1:4100");
    updateSharedOpencodeServerMock.mockResolvedValue("1.5.0");
  });

  it("loads the current runtime status", async () => {
    await expect(loader({
      context: {},
      params: {},
      request: new Request("http://scriptorium.test/settings/opencode"),
    } as never)).resolves.toEqual({
      runtime: {
        activeSince: 1_000_000,
        error: null,
        installedVersion: "1.4.0",
        isRunning: true,
        mode: "managed",
        restartRequired: false,
        runningVersion: "1.4.0",
        serverUrl: "http://127.0.0.1:4100",
      },
    });
  });

  it("restarts the managed shared runtime", async () => {
    const response = await action({
      context: {},
      params: {},
      request: createPostRequest(),
    } as never);

    expect(response).not.toBeInstanceOf(Response);
    expect(response).toMatchObject({
      data: { error: null, message: null, ok: true },
      init: null,
    });
    expect(restartSharedOpencodeServerMock).toHaveBeenCalledTimes(1);
  });

  it("starts the managed shared runtime when restart is requested while stopped", async () => {
    getSharedOpencodeRuntimeStatusMock.mockResolvedValue({
      activeSince: null,
      error: null,
      installedVersion: "1.4.0",
      isRunning: false,
      mode: "managed",
      restartRequired: false,
      runningVersion: null,
      serverUrl: null,
    });

    const response = await action({
      context: {},
      params: {},
      request: createPostRequest("restart"),
    } as never);

    expect(response).not.toBeInstanceOf(Response);
    expect(response).toMatchObject({
      data: { error: null, message: null, ok: true },
      init: null,
    });
    expect(startSharedOpencodeServerMock).toHaveBeenCalledTimes(1);
    expect(restartSharedOpencodeServerMock).not.toHaveBeenCalled();
  });

  it("updates the running managed runtime", async () => {
    const response = await action({
      context: {},
      params: {},
      request: createPostRequest("update"),
    } as never);

    expect(response).not.toBeInstanceOf(Response);
    expect(response).toMatchObject({
      data: {
        error: null,
        message: "Successfully updated to OpenCode 1.5.0. Restart OpenCode to apply it.",
        ok: true,
      },
      init: null,
    });
    expect(updateSharedOpencodeServerMock).toHaveBeenCalledTimes(1);
  });

  it("rejects update requests when OpenCode is not running", async () => {
    getSharedOpencodeRuntimeStatusMock.mockResolvedValue({
      activeSince: null,
      error: null,
      installedVersion: "1.4.0",
      isRunning: false,
      mode: "managed",
      restartRequired: false,
      runningVersion: null,
      serverUrl: null,
    });

    const response = await action({
      context: {},
      params: {},
      request: createPostRequest("update"),
    } as never);

    expect(response).not.toBeInstanceOf(Response);
    expect(response).toMatchObject({
      data: {
        error: "Start OpenCode before updating it.",
        message: null,
        ok: false,
      },
      init: { status: 409 },
    });
    expect(updateSharedOpencodeServerMock).not.toHaveBeenCalled();
  });

  it("rejects requests when OpenCode is externally managed", async () => {
    getSharedOpencodeRuntimeStatusMock.mockResolvedValue({
      activeSince: null,
      error: null,
      installedVersion: null,
      isRunning: true,
      mode: "external",
      restartRequired: false,
      runningVersion: "1.4.0",
      serverUrl: "http://127.0.0.1:44556",
    });

    const response = await action({
      context: {},
      params: {},
      request: createPostRequest(),
    } as never);

    expect(response).not.toBeInstanceOf(Response);
    expect(response).toMatchObject({
      data: {
        error: "OpenCode is managed externally.",
        message: null,
        ok: false,
      },
      init: { status: 409 },
    });
    expect(restartSharedOpencodeServerMock).not.toHaveBeenCalled();
    expect(updateSharedOpencodeServerMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported actions", async () => {
    const response = await action({
      context: {},
      params: {},
      request: createPostRequest("unknown"),
    } as never);

    expect(response).not.toBeInstanceOf(Response);
    expect(response).toMatchObject({
      data: {
        error: "That action is not supported.",
        message: null,
        ok: false,
      },
      init: { status: 400 },
    });
    expect(restartSharedOpencodeServerMock).not.toHaveBeenCalled();
    expect(updateSharedOpencodeServerMock).not.toHaveBeenCalled();
  });
});
