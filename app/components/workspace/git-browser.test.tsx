import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useSearchParams } from "react-router";
import { describe, expect, it } from "vitest";

import { GitBrowser } from "~/components/workspace/git-browser";
import type { GitChangedFiles, GitFileDiffResult, GitStatusSummary } from "~/lib/instances/types";

const changed: GitChangedFiles = {
  isRepository: true,
  files: [
    {
      changeType: "modified",
      indexStatus: " ",
      oldPath: null,
      path: "src/alpha.ts",
      workingTreeStatus: "M",
    },
    {
      changeType: "modified",
      indexStatus: " ",
      oldPath: null,
      path: "src/beta.ts",
      workingTreeStatus: "M",
    },
    {
      changeType: "modified",
      indexStatus: " ",
      oldPath: null,
      path: "src/gamma.ts",
      workingTreeStatus: "M",
    },
  ],
};

const git: GitStatusSummary = {
  ahead: 0,
  behind: 0,
  branch: "main",
  clean: false,
  isRepository: true,
  modified: 3,
  staged: 0,
  untracked: 0,
};

function buildSelected(path: string): GitFileDiffResult {
  return {
    binary: false,
    content: `content for ${path}`,
    diffContent: `@@ -1 +1 @@\n-${path}\n+updated ${path}`,
    diffSide: "new",
    isRepository: true,
    mode: "diff",
    oldPath: null,
    path,
  };
}

function GitBrowserHarness() {
  const [searchParams] = useSearchParams();
  const selectedPath = searchParams.get("path");

  return (
    <GitBrowser
      changed={changed}
      git={git}
      rootPath="/repo"
      selected={selectedPath ? buildSelected(selectedPath) : null}
      selectedError={null}
      selectedPath={selectedPath}
    />
  );
}

function renderGitBrowser(initialEntry = "/git?path=src/beta.ts") {
  const router = createMemoryRouter(
    [
      {
        path: "/git",
        element: <GitBrowserHarness />,
      },
    ],
    { initialEntries: [initialEntry] },
  );

  return { router, ...render(<RouterProvider router={router} />) };
}

describe("GitBrowser", () => {
  it("shows bold previous and next file buttons in the selected diff header", () => {
    renderGitBrowser();

    expect(screen.getByRole("link", { name: /previous changed file/i })).toHaveAttribute("href", "/git?path=src%2Falpha.ts");
    expect(screen.getByRole("link", { name: /next changed file/i })).toHaveAttribute("href", "/git?path=src%2Fgamma.ts");
  });

  it("disables previous navigation for the first changed file", () => {
    renderGitBrowser("/git?path=src/alpha.ts");

    expect(screen.queryByRole("link", { name: /previous changed file/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/previous changed file/i)).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: /next changed file/i })).toHaveAttribute("href", "/git?path=src%2Fbeta.ts");
  });

  it("disables next navigation for the last changed file", () => {
    renderGitBrowser("/git?path=src/gamma.ts");

    expect(screen.getByRole("link", { name: /previous changed file/i })).toHaveAttribute("href", "/git?path=src%2Fbeta.ts");
    expect(screen.queryByRole("link", { name: /next changed file/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/next changed file/i)).toHaveAttribute("aria-disabled", "true");
  });

  it("navigates between changed files without returning to the list", () => {
    const { router } = renderGitBrowser();

    fireEvent.click(screen.getByRole("link", { name: /next changed file/i }));

    expect(router.state.location.search).toBe("?path=src%2Fgamma.ts");
    expect(screen.getByText("src/gamma.ts")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /previous changed file/i }));

    expect(router.state.location.search).toBe("?path=src%2Fbeta.ts");
    expect(screen.getByText("src/beta.ts")).toBeInTheDocument();
  });
});
