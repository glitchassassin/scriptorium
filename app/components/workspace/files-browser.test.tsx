import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useSearchParams } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FilesBrowser, formatLineReference, formatWorkspacePath } from "~/components/workspace/files-browser";
import type { FileBrowserContent, FileBrowserListing } from "~/lib/instances/types";

const listing: FileBrowserListing = {
  currentPath: "/repo",
  entries: [
    { name: "alpha", path: "/repo/alpha", type: "directory" },
    { name: "readme.md", path: "/repo/readme.md", type: "file" },
  ],
  parentPath: null,
  rootPath: "/repo",
  selectionMode: "either",
};

function buildSelected(path: string): FileBrowserContent {
  const resolvedPath = path.startsWith("/") ? path : `/repo/${path}`;

  return {
    binary: false,
    content: Array.from({ length: 80 }, (_value, index) => `line ${index + 1}`).join("\n"),
    name: resolvedPath.split("/").at(-1) ?? resolvedPath,
    path: resolvedPath,
  };
}

function FilesBrowserHarness() {
  const [searchParams] = useSearchParams();
  const selectedPath = searchParams.get("file");
  const line = Number.parseInt(searchParams.get("line") || "", 10);
  const endLine = Number.parseInt(searchParams.get("endLine") || "", 10);
  const selectedLineRange = Number.isInteger(line) && line > 0
    ? { end: Number.isInteger(endLine) && endLine > 0 ? endLine : line, start: line }
    : null;

  return (
    <FilesBrowser
      listing={listing}
      rootPath="/repo"
      selected={selectedPath ? buildSelected(selectedPath) : null}
      selectedError={null}
      selectedLineRange={selectedLineRange}
      selectedPath={selectedPath}
    />
  );
}

function renderFilesBrowser(initialEntry = "/files?path=.") {
  const router = createMemoryRouter(
    [
      {
        path: "/files",
        element: <FilesBrowserHarness />,
      },
    ],
    { initialEntries: [initialEntry] },
  );

  return { router, ...render(<RouterProvider router={router} />) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("files browser references", () => {
  it("formats workspace-relative single-line references", () => {
    expect(formatLineReference(formatWorkspacePath("/repo", "/repo/src/app.ts"), { start: 12, end: 12 })).toBe(
      "@src/app.ts:12",
    );
  });

  it("formats workspace-relative line ranges", () => {
    expect(formatLineReference(formatWorkspacePath("/repo", "/repo/src/app.ts"), { start: 18, end: 12 })).toBe(
      "@src/app.ts:12-18",
    );
  });

  it("updates search params when selecting a file from the initial listing", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { router } = renderFilesBrowser();

    fireEvent.click(screen.getByRole("button", { name: "readme.md" }));

    expect(router.state.location.search).toBe("?path=.&file=readme.md");
    expect(screen.getByRole("button", { name: /back to workspace files/i })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns to the seeded listing without refetching when backing out of a selected file", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { router } = renderFilesBrowser("/files?path=.&file=readme.md");

    fireEvent.click(screen.getByRole("button", { name: /back to workspace files/i }));

    expect(router.state.location.search).toBe("?path=.");
    expect(screen.getByRole("button", { name: "alpha/" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "readme.md" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves expanded folders when backing out of a selected file", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === "string" ? input : input.toString(), "http://localhost");

      if (url.searchParams.get("path") === "/repo/alpha") {
        return new Response(
          JSON.stringify({
            error: null,
            listing: {
              currentPath: "/repo/alpha",
              entries: [{ name: "main.ts", path: "/repo/alpha/main.ts", type: "file" }],
              parentPath: "/repo",
              rootPath: "/repo",
              selectionMode: "either",
            },
          }),
        );
      }

      throw new Error(`Unexpected fetch: ${url.toString()}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    const { router } = renderFilesBrowser();

    fireEvent.click(screen.getByRole("button", { name: "Expand alpha/" }));

    await screen.findByRole("button", { name: "main.ts" });

    fireEvent.click(screen.getByRole("button", { name: "main.ts" }));

    expect(router.state.location.search).toBe("?path=.&file=alpha%2Fmain.ts");

    fireEvent.click(screen.getByRole("button", { name: /back to workspace files/i }));

    await waitFor(() => {
      expect(router.state.location.search).toBe("?path=.");
    });

    expect(screen.getByRole("button", { name: "Collapse alpha/" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "main.ts" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("highlights a deep-linked line range", () => {
    renderFilesBrowser("/files?path=.&file=readme.md&line=2&endLine=3");

    expect(screen.getByText("line 2").closest('[aria-selected="true"]')).toBeInTheDocument();
    expect(screen.getByText("line 3").closest('[aria-selected="true"]')).toBeInTheDocument();
    expect(screen.getByText("line 1").closest('[aria-selected="true"]')).not.toBeInTheDocument();
  });

  it("scrolls a deep-linked line into view on first render", async () => {
    renderFilesBrowser("/files?path=.&file=readme.md&line=40");

    await waitFor(() => {
      expect(screen.getByTestId("code-viewer-scroll-pane")).toHaveProperty("scrollTop", 888);
    });
  });
});
