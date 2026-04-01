import { describe, expect, it, vi } from "vitest";

vi.mock("~/components/pwa/service-worker-registration", () => ({
  ServiceWorkerRegistration: () => null,
}));

vi.mock("~/lib/projects/runtime.server", () => ({
  ensureStarted: vi.fn(),
}));

import { getErrorDocumentTitle } from "~/root";

describe("root error titles", () => {
  it("returns a 404 title for route errors", () => {
    expect(getErrorDocumentTitle({ data: null, internal: true, status: 404, statusText: "Not Found" })).toBe(
      "404 | scriptorium",
    );
  });

  it("returns a generic title for other errors", () => {
    expect(getErrorDocumentTitle(new Error("boom"))).toBe("Error | scriptorium");
  });
});
