// @vitest-environment node

import { describe, expect, it } from "vitest";

import { parseSessionReviewModeOrThrow } from "~/routes/_app/projects.$projectId/review.server";

describe("parseSessionReviewModeOrThrow", () => {
  it("accepts supported review modes", () => {
    expect(parseSessionReviewModeOrThrow("session")).toBe("session");
    expect(parseSessionReviewModeOrThrow("recent")).toBe("recent");
    expect(parseSessionReviewModeOrThrow("uncommitted")).toBe("uncommitted");
  });

  it("throws a 404 for unknown review modes", () => {
    expect(() => parseSessionReviewModeOrThrow("archive")).toThrowError(Response);

    try {
      parseSessionReviewModeOrThrow("archive");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(404);
    }
  });
});
