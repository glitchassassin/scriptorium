// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthenticatedPasskeyMock = vi.fn();
const getProjectOrThrowMock = vi.fn();
const getSharedOpencodeRuntimeStatusMock = vi.fn();
const listOpencodeSessionsMock = vi.fn();
const listOpencodeQuestionRequestsMock = vi.fn();
const markSessionReadMock = vi.fn();
const listSessionReadStatusesMock = vi.fn();
const startSharedOpencodeServerMock = vi.fn();

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
  createOpencodeSession: vi.fn(),
  getOpencodeSessionStatuses: vi.fn(),
  listOpencodeQuestionRequests: (...args: unknown[]) => listOpencodeQuestionRequestsMock(...args),
  listOpencodeSessions: (...args: unknown[]) => listOpencodeSessionsMock(...args),
  removeOpencodeSession: vi.fn(),
}));

vi.mock("~/lib/session-read-status.server", () => ({
  listSessionReadStatuses: (...args: unknown[]) => listSessionReadStatusesMock(...args),
  markSessionRead: (...args: unknown[]) => markSessionReadMock(...args),
}));

import { action } from "~/routes/_app/projects.$projectId/index";

describe("project detail action", () => {
  beforeEach(() => {
    requireAuthenticatedPasskeyMock.mockReset();
    getProjectOrThrowMock.mockReset();
    getSharedOpencodeRuntimeStatusMock.mockReset();
    listOpencodeSessionsMock.mockReset();
    listOpencodeQuestionRequestsMock.mockReset();
    markSessionReadMock.mockReset();
    listSessionReadStatusesMock.mockReset();
    startSharedOpencodeServerMock.mockReset();

    requireAuthenticatedPasskeyMock.mockResolvedValue(undefined);
    getProjectOrThrowMock.mockResolvedValue({
      id: "project-1",
      name: "Alpha",
      directory: "/tmp/alpha",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
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
    startSharedOpencodeServerMock.mockResolvedValue("http://127.0.0.1:4100");
  });

  it("starts OpenCode when requested", async () => {
    const formData = new FormData();
    formData.set("intent", "start-opencode");

    const response = await action({
      params: { projectId: "project-1" },
      request: new Request("http://localhost/projects/project-1", { method: "POST", body: formData }),
      context: {},
    } as never);

    expect(response).not.toBeInstanceOf(Response);
    expect(response).toMatchObject({ data: { error: null }, init: null });
    expect(startSharedOpencodeServerMock).toHaveBeenCalledTimes(1);
  });

  it("marks only unread parent sessions as read", async () => {
    listOpencodeSessionsMock.mockResolvedValue([
      {
        id: "session-child",
        parentID: "session-root-unread",
        title: "Unread child",
        directory: null,
        createdAt: 3,
        updatedAt: 1000,
      },
      {
        id: "session-root-read",
        parentID: null,
        title: "Read root",
        directory: null,
        createdAt: 1,
        updatedAt: 5,
      },
      {
        id: "session-root-unread",
        parentID: null,
        title: "Unread root",
        directory: null,
        createdAt: 2,
        updatedAt: 1000,
      },
    ]);
    listSessionReadStatusesMock.mockResolvedValue([
      { sessionId: "session-root-read", lastReadAt: 5 },
      { sessionId: "session-root-unread", lastReadAt: 1 },
    ]);
    listOpencodeQuestionRequestsMock.mockResolvedValue([]);

    const formData = new FormData();
    formData.set("intent", "mark-all-read");

    await action({
      params: { projectId: "project-1" },
      request: new Request("http://localhost/projects/project-1", { method: "POST", body: formData }),
      context: {},
    } as never);

    expect(markSessionReadMock).toHaveBeenCalledTimes(1);
    expect(markSessionReadMock).toHaveBeenCalledWith({ sessionId: "session-root-unread" });
  });

  it("does not mark question-only unread parent sessions as read", async () => {
    listOpencodeSessionsMock.mockResolvedValue([
      {
        id: "session-root-question",
        parentID: null,
        title: "Question root",
        directory: null,
        createdAt: 1,
        updatedAt: 5,
      },
    ]);
    listSessionReadStatusesMock.mockResolvedValue([
      { sessionId: "session-root-question", lastReadAt: 5 },
    ]);
    listOpencodeQuestionRequestsMock.mockResolvedValue([
      { id: "question-1", sessionID: "session-root-question", questions: [] },
    ]);

    const formData = new FormData();
    formData.set("intent", "mark-all-read");

    await action({
      params: { projectId: "project-1" },
      request: new Request("http://localhost/projects/project-1", { method: "POST", body: formData }),
      context: {},
    } as never);

    expect(markSessionReadMock).not.toHaveBeenCalled();
  });
});
