import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SingleColumnFileList } from "~/components/files/file-list";

const LIST_ENTRIES: Array<{ name: string; path: string; type: "directory" | "file" }> = [
  { name: "alpha", path: "/repo/alpha", type: "directory" },
  { name: "main.ts", path: "/repo/main.ts", type: "file" },
];

describe("SingleColumnFileList", () => {
  it("navigates when a directory row is activated", () => {
    const onBrowseTo = vi.fn();

    render(
      <SingleColumnFileList
        currentPath="/repo"
        parentPath="/"
        entries={LIST_ENTRIES}
        onBrowseTo={onBrowseTo}
      />,
    );

    const directoryButton = screen.getByRole("button", { name: "alpha/" });

    fireEvent.click(directoryButton);

    expect(onBrowseTo).toHaveBeenCalledWith("/repo/alpha");
  });

  it("calls selection callback for file rows", () => {
    const onSelectionChange = vi.fn();

    render(
      <SingleColumnFileList
        currentPath="/repo"
        parentPath={null}
        entries={LIST_ENTRIES}
        selectionMode="file"
        onSelectionChange={onSelectionChange}
      />,
    );

    const fileButton = screen.getByRole("button", { name: "main.ts" });
    fireEvent.click(fileButton);

    expect(onSelectionChange).toHaveBeenCalledWith({
      name: "main.ts",
      path: "/repo/main.ts",
      type: "file",
    });
  });

  it("hides file rows in directory mode", () => {
    render(
      <SingleColumnFileList
        currentPath="/repo"
        parentPath={null}
        entries={LIST_ENTRIES}
        selectionMode="directory"
      />,
    );

    expect(screen.getByRole("button", { name: "alpha/" })).toBeInTheDocument();
    expect(screen.queryByText("main.ts")).not.toBeInTheDocument();
  });

  it("can show selected selection state", () => {
    render(
      <SingleColumnFileList
        currentPath="/repo"
        parentPath={null}
        entries={LIST_ENTRIES}
        selectedPath="/repo/main.ts"
      />,
    );

    const row = screen.getByRole("button", { name: "main.ts" }).parentElement;

    expect(row).toHaveClass("font-bold");
  });

  it("renders item descriptions when provided", () => {
    render(
      <SingleColumnFileList
        currentPath="/repo"
        parentPath={null}
        entries={LIST_ENTRIES}
        getItemDescription={(entry) => (entry.type === "file" ? "src/" : null)}
      />,
    );

    expect(screen.getByText("src/")).toBeInTheDocument();
  });

  it("shows file rows in either mode", () => {
    render(
      <SingleColumnFileList
        currentPath="/repo"
        parentPath={null}
        entries={LIST_ENTRIES}
        selectionMode="either"
      />,
    );

    expect(screen.getByRole("button", { name: "alpha/" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "main.ts" })).toBeInTheDocument();
  });
});
