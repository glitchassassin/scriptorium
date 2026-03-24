import { fireEvent, render, screen } from "@testing-library/react";
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
  return {
    binary: false,
    content: `content for ${path}`,
    name: path.split("/").at(-1) ?? path,
    path,
  };
}

function FilesBrowserHarness() {
  const [searchParams] = useSearchParams();
  const selectedPath = searchParams.get("file");

  return (
    <FilesBrowser
      listing={listing}
      rootPath="/repo"
      selected={selectedPath ? buildSelected(selectedPath) : null}
      selectedError={null}
      selectedPath={selectedPath}
    />
  );
}

function renderFilesBrowser(initialEntry = "/files?path=%2Frepo") {
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

    expect(router.state.location.search).toBe("?path=%2Frepo&file=%2Frepo%2Freadme.md");
    expect(screen.getByText("readme.md")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns to the seeded listing without refetching when backing out of a selected file", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { router } = renderFilesBrowser("/files?path=%2Frepo&file=%2Frepo%2Freadme.md");

    fireEvent.click(screen.getByRole("button", { name: /back to workspace files/i }));

    expect(router.state.location.search).toBe("?path=%2Frepo");
    expect(screen.getByRole("button", { name: "alpha/" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "readme.md" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
