import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useParams, useSearchParams } from "react-router";
import { describe, expect, it } from "vitest";

import { ReviewBrowser } from "~/components/workspace/review-browser";
import type { GitStatusSummary } from "~/lib/projects/types";
import type { ReviewData, ReviewFileSelection } from "~/lib/review";
import { getSessionReviewModeOptions } from "~/lib/review";

const review: ReviewData = {
  emptyLabel: "No review changes.",
  files: [
    {
      oldPath: null,
      path: "src/zeta.ts",
      status: "M",
    },
    {
      oldPath: null,
      path: "src/nested/alpha.ts",
      status: "M",
    },
    {
      oldPath: null,
      path: "src/beta.ts",
      status: "M",
    },
  ],
  git: {
    ahead: 0,
    behind: 0,
    branch: "main",
    clean: false,
    isRepository: true,
    modified: 3,
    staged: 0,
    untracked: 0,
  } satisfies GitStatusSummary,
};

function buildSelected(path: string): ReviewFileSelection {
  return {
    binary: false,
    content: `content for ${path}`,
    diffContent: `@@ -1 +1 @@\n-${path}\n+updated ${path}`,
    diffSide: "new",
    mode: "diff",
    oldPath: null,
    path,
  };
}

function SessionReviewHarness() {
  const [searchParams] = useSearchParams();
  const { mode } = useParams();
  const selectedPath = searchParams.get("path");

  return (
    <ReviewBrowser
      mode={mode === "session" || mode === "recent" || mode === "uncommitted" ? mode : "uncommitted"}
      modes={getSessionReviewModeOptions()}
      review={review}
      selected={selectedPath ? buildSelected(selectedPath) : null}
      selectedError={null}
      selectedPath={selectedPath}
      switchBasePath="/review"
    />
  );
}

function InstanceReviewHarness() {
  const [searchParams] = useSearchParams();
  const selectedPath = searchParams.get("path");

  return (
    <ReviewBrowser
      mode="uncommitted"
      review={review}
      selected={selectedPath ? buildSelected(selectedPath) : null}
      selectedError={null}
      selectedPath={selectedPath}
    />
  );
}

function renderSessionReview(initialEntry = "/review/uncommitted?path=src/nested/alpha.ts") {
  const router = createMemoryRouter(
    [
      {
        path: "/review/:mode",
        element: <SessionReviewHarness />,
      },
    ],
    { initialEntries: [initialEntry] },
  );

  return { router, ...render(<RouterProvider router={router} />) };
}

function renderInstanceReview(initialEntry = "/review/uncommitted") {
  const router = createMemoryRouter(
    [
      {
        path: "/review/uncommitted",
        element: <InstanceReviewHarness />,
      },
    ],
    { initialEntries: [initialEntry] },
  );

  return { router, ...render(<RouterProvider router={router} />) };
}

describe("ReviewBrowser", () => {
  it("groups reviewed files into an expanded folder tree", () => {
    renderSessionReview("/review/uncommitted");

    expect(screen.getByRole("button", { name: "src/" })).toHaveClass("font-bold");
    expect(screen.getByRole("button", { name: /alpha.ts/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /beta.ts/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /zeta.ts/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "nested/" })).toHaveClass("font-bold");
    expect(screen.getAllByText("M")).toHaveLength(3);
  });

  it("shows previous and next file buttons in the selected diff header", () => {
    renderSessionReview("/review/uncommitted?path=src/beta.ts");

    expect(screen.getByRole("link", { name: /previous file/i })).toHaveAttribute("href", "/review/uncommitted?path=src%2Fnested%2Falpha.ts");
    expect(screen.getByRole("link", { name: /next file/i })).toHaveAttribute("href", "/review/uncommitted?path=src%2Fzeta.ts");
  });

  it("disables previous navigation for the first reviewed file", () => {
    renderSessionReview("/review/uncommitted?path=src/nested/alpha.ts");

    expect(screen.queryByRole("link", { name: /previous file/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/previous file/i)).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: /next file/i })).toHaveAttribute("href", "/review/uncommitted?path=src%2Fbeta.ts");
  });

  it("disables next navigation for the last reviewed file", () => {
    renderSessionReview("/review/uncommitted?path=src/zeta.ts");

    expect(screen.getByRole("link", { name: /previous file/i })).toHaveAttribute("href", "/review/uncommitted?path=src%2Fbeta.ts");
    expect(screen.queryByRole("link", { name: /next file/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/next file/i)).toHaveAttribute("aria-disabled", "true");
  });

  it("navigates between reviewed files without returning to the list", () => {
    const { router } = renderSessionReview();

    fireEvent.click(screen.getByRole("link", { name: /next file/i }));

    expect(router.state.location.search).toBe("?path=src%2Fbeta.ts");
    expect(screen.getByText("src/beta.ts")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /previous file/i }));

    expect(router.state.location.search).toBe("?path=src%2Fnested%2Falpha.ts");
    expect(screen.getByText("src/nested/alpha.ts")).toBeInTheDocument();
  });

  it("preserves collapsed folders when backing out of a selected diff", () => {
    const { router } = renderSessionReview("/review/uncommitted");

    fireEvent.click(screen.getByRole("button", { name: "Collapse nested/" }));

    expect(screen.queryByRole("button", { name: /alpha.ts/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /beta.ts/ }));

    expect(router.state.location.search).toBe("?path=src%2Fbeta.ts");

    fireEvent.click(screen.getByRole("button", { name: /back to uncommitted changes/i }));

    expect(router.state.location.search).toBe("");
    expect(screen.getByRole("button", { name: "Expand nested/" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /alpha.ts/ })).not.toBeInTheDocument();
  });

  it("switches review modes without preserving query parameters", () => {
    const { router } = renderSessionReview("/review/uncommitted?path=src/beta.ts");

    fireEvent.click(screen.getByRole("button", { name: "Review mode" }));
    fireEvent.click(screen.getByRole("option", { name: "Session Changes" }));

    expect(router.state.location.pathname).toBe("/review/session");
    expect(router.state.location.search).toBe("");
  });

  it("omits the mode picker for project review", () => {
    renderInstanceReview();

    expect(screen.queryByRole("button", { name: "Review mode" })).not.toBeInTheDocument();
    expect(screen.getByText("Uncommitted Changes")).toBeInTheDocument();
  });
});
