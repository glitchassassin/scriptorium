// @vitest-environment node

import { describe, expect, it } from "vitest";

import { withTestDatabase } from "~/lib/db.server";
import {
  listSessionReadStatuses,
  markSessionRead,
  subscribeToSessionReadEvents,
} from "~/lib/session-read-status.server";

describe("session read status", () => {
  it("stores and updates last-read timestamps", async () => {
    await withTestDatabase(() => {
      expect(listSessionReadStatuses()).toEqual([]);

      markSessionRead({ sessionId: "session-1" }, new Date("2026-03-18T12:00:00.000Z"));
      markSessionRead({ sessionId: "session-1" }, new Date("2026-03-18T12:05:00.000Z"));

      expect(listSessionReadStatuses()).toEqual([
        {
          sessionId: "session-1",
          lastReadAt: Date.parse("2026-03-18T12:05:00.000Z"),
        },
      ]);
    });
  });

  it("does not move timestamps backwards", async () => {
    await withTestDatabase(() => {
      markSessionRead({ sessionId: "session-1" }, new Date("2026-03-18T12:05:00.000Z"));
      markSessionRead({ sessionId: "session-1" }, new Date("2026-03-18T12:00:00.000Z"));

      expect(listSessionReadStatuses()).toEqual([
        {
          sessionId: "session-1",
          lastReadAt: Date.parse("2026-03-18T12:05:00.000Z"),
        },
      ]);
    });
  });

  it("publishes read events to all subscribers", async () => {
    await withTestDatabase(() => {
      const subscriberOne = new Set<number>();
      const subscriberTwo = new Set<number>();
      const unsubscribeOne = subscribeToSessionReadEvents((event) => {
        subscriberOne.add(event.lastReadAt);
      });
      const unsubscribeTwo = subscribeToSessionReadEvents((event) => {
        subscriberTwo.add(event.lastReadAt);
      });

      markSessionRead({ sessionId: "session-1" }, new Date("2026-03-18T12:00:00.000Z"));

      unsubscribeOne();
      unsubscribeTwo();

      expect([...subscriberOne]).toEqual([Date.parse("2026-03-18T12:00:00.000Z")]);
      expect([...subscriberTwo]).toEqual([Date.parse("2026-03-18T12:00:00.000Z")]);
    });
  });
});
