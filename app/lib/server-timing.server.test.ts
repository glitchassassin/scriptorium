import { describe, expect, it } from "vitest";

import { getServerTimingHeaders, makeTimings, time } from "~/lib/server-timing.server";

describe("server timing", () => {
  it("formats timing entries into a Server-Timing header", async () => {
    const timings = makeTimings("session loader");

    await time(() => Promise.resolve("messages"), {
      desc: "load messages",
      timings,
      type: "messages",
    });

    const header = timings.toString();

    expect(header).toContain("session_loader");
    expect(header).toContain("messages");
    expect(header).toContain('desc="load messages"');
  });

  it("merges current and parent Server-Timing headers", () => {
    const headers = getServerTimingHeaders({
      loaderHeaders: new Headers({ "Server-Timing": "child;dur=2.0" }),
      parentHeaders: new Headers({ "Server-Timing": "parent;dur=1.0" }),
    });

    expect(headers.get("Server-Timing")).toBe("child;dur=2.0, parent;dur=1.0");
  });
});
