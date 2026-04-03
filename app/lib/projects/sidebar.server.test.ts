// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from "vitest";

const getOpencodeSessionMock = vi.fn();
const getOpencodeSessionStatusesMock = vi.fn();
const listOpencodeQuestionRequestsMock = vi.fn();
const listRecentSidebarSessionsMock = vi.fn();

vi.mock("~/lib/projects/opencode.server", () => ({
  getOpencodeSession: (...args: unknown[]) => getOpencodeSessionMock(...args),
  getOpencodeSessionStatuses: (...args: unknown[]) => getOpencodeSessionStatusesMock(...args),
  listOpencodeQuestionRequests: (...args: unknown[]) => listOpencodeQuestionRequestsMock(...args),
  listRecentSidebarSessions: (...args: unknown[]) => listRecentSidebarSessionsMock(...args),
}));

import { loadSidebarProjectState } from "~/lib/projects/sidebar.server";

describe("loadSidebarProjectState", () => {
  beforeEach(() => {
    getOpencodeSessionMock.mockReset();
    getOpencodeSessionStatusesMock.mockReset();
    listOpencodeQuestionRequestsMock.mockReset();
    listRecentSidebarSessionsMock.mockReset();
  });

  it("keeps pending-question root sessions visible and ignores child sessions", async () => {
    listRecentSidebarSessionsMock.mockResolvedValue([
      {
        id: "session-1",
        parentID: null,
        title: "Recent root",
        directory: "/tmp/alpha",
        createdAt: 10,
        updatedAt: 20,
      },
    ]);
    getOpencodeSessionStatusesMock.mockResolvedValue({
      "session-2": { type: "busy" },
    });
    listOpencodeQuestionRequestsMock.mockResolvedValue([
      { id: "question-root", sessionID: "session-2", questions: [] },
      { id: "question-child", sessionID: "session-3", questions: [] },
    ]);
    getOpencodeSessionMock.mockImplementation(async (_project: unknown, sessionId: string) => {
      if (sessionId === "session-2") {
        return {
          id: "session-2",
          directory: "/tmp/alpha",
          parentID: undefined,
          title: "Older root",
          time: { created: 1, updated: 2 },
        };
      }

      return {
        id: "session-3",
        directory: "/tmp/alpha",
        parentID: "session-1",
        title: "Child session",
        time: { created: 3, updated: 4 },
      };
    });

    const state = await loadSidebarProjectState(
      {
        id: "project-1",
        name: "Alpha",
        directory: "/tmp/alpha",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      new Map([["session-2", 100]]),
    );

    expect(state.recentSessions.map((session) => session.id)).toEqual(["session-1", "session-2"]);
    expect(state.recentSessions[1]).toMatchObject({
      id: "session-2",
      pendingQuestionRequestIds: ["question-root"],
    });
    expect(state.recentSessionStatuses["session-2"]).toEqual({ type: "busy" });
  });
});
