import { describe, expect, it } from "vitest";

import { SESSION_UNREAD_GRACE_MS, isSessionUnread } from "~/lib/projects/sidebar";

describe("isSessionUnread", () => {
  const session = {
    id: "session-1",
    parentID: null,
    title: null,
    directory: null,
    createdAt: 1_000,
    updatedAt: 1_000,
  };

  it("keeps a session read when activity is within the grace period", () => {
    expect(isSessionUnread(session, 1_000 - SESSION_UNREAD_GRACE_MS)).toBe(false);
    expect(isSessionUnread(session, 1_000 - SESSION_UNREAD_GRACE_MS + 1)).toBe(false);
  });

  it("marks a session unread when activity is outside the grace period", () => {
    expect(isSessionUnread(session, 1_000 - SESSION_UNREAD_GRACE_MS - 1)).toBe(true);
  });

  it("marks sessions unread when no read timestamp exists", () => {
    expect(isSessionUnread(session, null)).toBe(true);
  });
});
