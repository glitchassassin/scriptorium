import { describe, expect, it, vi } from "vitest";

vi.mock("~/components/pwa/service-worker-registration", () => ({
  ServiceWorkerRegistration: () => null,
}));

vi.mock("~/lib/instances/runtime.server", () => ({
  ensureStarted: vi.fn(),
}));

import { getErrorDocumentTitle, getTitleFromMatches } from "~/root";

describe("root titles", () => {
  it("uses route breadcrumbs for document titles", () => {
    expect(getTitleFromMatches([
      {
        data: undefined,
        handle: undefined,
        id: "root",
        params: {},
      },
      {
        data: { instance: { name: "Workspace" }, session: { id: "session-1", title: "Planning" } },
        handle: {
          title: [
            { label: "Workspace", to: "/instances/instance-1" },
            { label: "Planning", to: "/instances/instance-1/sessions/session-1" },
            { label: "git" },
          ],
        },
        id: "routes/_app/instances.$instanceId/sessions.$sessionId/git",
        params: { instanceId: "instance-1", sessionId: "session-1" },
      },
    ] as never)).toBe("git | Planning | scriptorium");
  });

  it("falls back to the app name when no route title exists", () => {
    expect(getTitleFromMatches([] as never)).toBe("scriptorium");
  });

  it("returns a 404 title for route errors", () => {
    expect(getErrorDocumentTitle({ data: null, internal: true, status: 404, statusText: "Not Found" })).toBe(
      "404 | scriptorium",
    );
  });
});
