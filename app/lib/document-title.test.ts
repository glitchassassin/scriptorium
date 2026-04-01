import { describe, expect, it } from "vitest";

import { APP_NAME, getDocumentTitle } from "~/lib/document-title";

describe("document titles", () => {
  it("joins page labels ahead of the app name", () => {
    expect(getDocumentTitle("review", "Planning")).toBe("review | Planning | scriptorium");
  });

  it("trims and ignores empty title parts", () => {
    expect(getDocumentTitle("  files  ", "", "  Session  ", undefined)).toBe("files | Session | scriptorium");
  });

  it("falls back to the app name when no labels remain", () => {
    expect(getDocumentTitle("", "   ", null, undefined)).toBe(APP_NAME);
  });
});
