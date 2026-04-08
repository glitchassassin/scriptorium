// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthenticatedPasskeyMock = vi.fn();
const getProjectOrThrowMock = vi.fn();
const getSharedOpencodeRuntimeStatusMock = vi.fn();
const startSharedOpencodeServerMock = vi.fn();
const listOpencodeMessagePageMock = vi.fn();
const listOpencodePermissionRequestsMock = vi.fn();
const listOpencodeQuestionRequestsMock = vi.fn();
const getOpencodeSessionMock = vi.fn();
const getOpencodeSessionStatusesMock = vi.fn();
const listOpencodeAgentsMock = vi.fn();
const listOpencodeCommandsMock = vi.fn();
const getOpencodeProviderCatalogMock = vi.fn();
const getOpencodeConfigMock = vi.fn();

vi.mock("~/lib/auth/guards.server", () => ({
  requireAuthenticatedPasskey: (...args: unknown[]) => requireAuthenticatedPasskeyMock(...args),
}));

vi.mock("~/lib/projects/runtime.server", () => ({
  getProjectOrThrow: (...args: unknown[]) => getProjectOrThrowMock(...args),
}));

vi.mock("~/lib/opencode/shared-runtime.server", () => ({
  getSharedOpencodeRuntimeStatus: (...args: unknown[]) => getSharedOpencodeRuntimeStatusMock(...args),
  startSharedOpencodeServer: (...args: unknown[]) => startSharedOpencodeServerMock(...args),
}));

vi.mock("~/lib/projects/opencode.server", () => ({
  abortOpencodeSession: vi.fn(),
  forkOpencodeSession: vi.fn(),
  getOpencodeConfig: (...args: unknown[]) => getOpencodeConfigMock(...args),
  getOpencodeSession: (...args: unknown[]) => getOpencodeSessionMock(...args),
  getOpencodeSessionStatuses: (...args: unknown[]) => getOpencodeSessionStatusesMock(...args),
  getOpencodeProviderCatalog: (...args: unknown[]) => getOpencodeProviderCatalogMock(...args),
  listOpencodeAgents: (...args: unknown[]) => listOpencodeAgentsMock(...args),
  listOpencodeCommands: (...args: unknown[]) => listOpencodeCommandsMock(...args),
  listOpencodeMessagePage: (...args: unknown[]) => listOpencodeMessagePageMock(...args),
  listOpencodeMessages: vi.fn(),
  listOpencodePermissionRequests: (...args: unknown[]) => listOpencodePermissionRequestsMock(...args),
  listOpencodeQuestionRequests: (...args: unknown[]) => listOpencodeQuestionRequestsMock(...args),
  revertOpencodeSession: vi.fn(),
  submitOpencodeCommand: vi.fn(),
  submitOpencodePrompt: vi.fn(),
  unrevertOpencodeSession: vi.fn(),
}));

vi.mock("~/lib/model-usage.server", () => ({
  listRecentModelChoices: vi.fn(),
  resolveSessionModelChoice: vi.fn(),
}));

import { action, loader } from "~/routes/_app/projects.$projectId/sessions.$sessionId/_layout";

describe("project session layout route", () => {
  beforeEach(() => {
    requireAuthenticatedPasskeyMock.mockReset();
    getProjectOrThrowMock.mockReset();
    getSharedOpencodeRuntimeStatusMock.mockReset();
    startSharedOpencodeServerMock.mockReset();
    listOpencodeMessagePageMock.mockReset();
    listOpencodePermissionRequestsMock.mockReset();
    listOpencodeQuestionRequestsMock.mockReset();
    getOpencodeSessionMock.mockReset();
    getOpencodeSessionStatusesMock.mockReset();
    listOpencodeAgentsMock.mockReset();
    listOpencodeCommandsMock.mockReset();
    getOpencodeProviderCatalogMock.mockReset();
    getOpencodeConfigMock.mockReset();

    requireAuthenticatedPasskeyMock.mockResolvedValue(undefined);
    getProjectOrThrowMock.mockResolvedValue({ id: "project-1", name: "Alpha", directory: "/tmp/alpha" });
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
    startSharedOpencodeServerMock.mockResolvedValue("http://127.0.0.1:4100");
  });

  it("returns a stopped state without loading session data", async () => {
    await expect(loader({
      params: { projectId: "project-1", sessionId: "session-1" },
      request: new Request("http://localhost/projects/project-1/sessions/session-1"),
      context: {},
    } as never)).resolves.toMatchObject({
      data: {
        project: { id: "project-1", name: "Alpha", directory: "/tmp/alpha" },
        sessionId: "session-1",
        state: "stopped",
      },
    });

    expect(listOpencodeMessagePageMock).not.toHaveBeenCalled();
    expect(getOpencodeSessionMock).not.toHaveBeenCalled();
  });

  it("starts OpenCode when requested", async () => {
    const formData = new FormData();
    formData.set("intent", "start-opencode");

    const response = await action({
      params: { projectId: "project-1", sessionId: "session-1" },
      request: new Request("http://localhost/projects/project-1/sessions/session-1", { method: "POST", body: formData }),
      context: {},
    } as never);

    expect(response).not.toBeInstanceOf(Response);
    expect(response).toMatchObject({
      data: { error: null, intent: "start-opencode", ok: true },
      init: null,
    });
    expect(startSharedOpencodeServerMock).toHaveBeenCalledTimes(1);
  });

  it("blocks other actions while OpenCode is stopped", async () => {
    const formData = new FormData();
    formData.set("intent", "prompt");

    const response = await action({
      params: { projectId: "project-1", sessionId: "session-1" },
      request: new Request("http://localhost/projects/project-1/sessions/session-1", { method: "POST", body: formData }),
      context: {},
    } as never);

    expect(response).not.toBeInstanceOf(Response);
    expect(response).toMatchObject({
      data: { error: "Start OpenCode before using this session.", intent: "prompt", ok: false },
      init: { status: 409 },
    });
  });
});
