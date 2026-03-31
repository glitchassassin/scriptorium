import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FileTreeList } from "~/components/files/file-list";
import type { FileTreeNode } from "~/lib/projects/types";

const TREE: FileTreeNode[] = [
  {
    children: [
      {
        name: "main.ts",
        path: "/repo/alpha/main.ts",
        type: "file",
      },
    ],
    name: "alpha",
    path: "/repo/alpha",
    type: "directory",
  },
  {
    name: "readme.md",
    path: "/repo/readme.md",
    type: "file",
  },
];

describe("FileTreeList", () => {
  it("toggles a directory when the row is activated in file mode", () => {
    const onToggleDirectory = vi.fn();

    render(<FileTreeList onToggleDirectory={onToggleDirectory} selectionMode="file" tree={TREE} />);

    fireEvent.click(screen.getByRole("button", { name: "alpha/" }));

    expect(onToggleDirectory).toHaveBeenCalledWith("/repo/alpha");
  });

  it("calls selection callback for file rows", () => {
    const onSelectionChange = vi.fn();

    render(
      <FileTreeList
        expandedPaths={["/repo/alpha"]}
        onSelectionChange={onSelectionChange}
        selectionMode="file"
        tree={TREE}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "main.ts" }));

    expect(onSelectionChange).toHaveBeenCalledWith({
      name: "main.ts",
      path: "/repo/alpha/main.ts",
      type: "file",
    });
  });

  it("hides file rows in directory mode", () => {
    render(<FileTreeList expandedPaths={["/repo/alpha"]} selectionMode="directory" tree={TREE} />);

    expect(screen.getByRole("button", { name: "alpha/" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "main.ts" })).not.toBeInTheDocument();
  });

  it("renders folders in bold and selected files underlined", () => {
    render(
      <FileTreeList expandedPaths={["/repo/alpha"]} selectedPath="/repo/alpha/main.ts" selectionMode="file" tree={TREE} />,
    );

    expect(screen.getByRole("button", { name: "alpha/" })).toHaveClass("font-bold");
    expect(screen.getByRole("button", { name: "main.ts" })).toHaveClass("underline");
  });

  it("selects directories in directory mode", () => {
    const onSelectionChange = vi.fn();

    render(<FileTreeList onSelectionChange={onSelectionChange} selectionMode="directory" tree={TREE} />);

    fireEvent.click(screen.getByRole("button", { name: "alpha/" }));

    expect(onSelectionChange).toHaveBeenCalledWith({
      name: "alpha",
      path: "/repo/alpha",
      type: "directory",
    });
  });

  it("renders an indented secondary empty-folder message", () => {
    render(
      <FileTreeList
        expandedPaths={["/repo/alpha"]}
        selectionMode="file"
        tree={[
          {
            children: [],
            name: "alpha",
            path: "/repo/alpha",
            type: "directory",
          },
        ]}
      />,
    );

    const emptyMessage = screen.getByText("(empty)");

    expect(emptyMessage).toHaveClass("text-lg", "leading-7", "italic", "opacity-60");
    expect(emptyMessage).toHaveStyle({ paddingLeft: "5.25rem" });
  });
});
