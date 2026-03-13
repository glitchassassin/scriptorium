import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { CodeViewer } from "~/components/files/code-viewer";

describe("CodeViewer", () => {
  it("renders text mode with line numbers", () => {
    render(<CodeViewer content={`const a = 1;\nconst b = 2;`} />);

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("const a = 1;")).toBeInTheDocument();
  });

  it("renders unified diff mode with old and new line numbers", () => {
    render(
      <CodeViewer
        content={`new\nshared`}
        diffContent={`@@ -1,2 +1,2 @@\n-old\n+new\n shared`}
        mode="diff"
      />,
    );

    expect(screen.getByText("new")).toBeInTheDocument();
    expect(screen.getByText("old")).toBeInTheDocument();
    expect(screen.getByText("shared")).toBeInTheDocument();
    expect(screen.getAllByText("1")).toHaveLength(2);
  });

  it("renders deleted files against the old file as the canonical view", () => {
    render(
      <CodeViewer
        content={`first\nsecond`}
        diffContent={`@@ -1,2 +0,0 @@\n-first\n-second`}
        diffSide="old"
        mode="diff"
      />,
    );

    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
    expect(screen.getAllByText("-")).toHaveLength(2);
  });

  it("adds borders around each contiguous changed group", () => {
    render(
      <CodeViewer
        content={`added\nkeep`}
        diffContent={`@@ -1,4 +1,2 @@\n+added\n keep\n-a\n-b\n-c`}
        mode="diff"
      />,
    );

    const addedRow = screen.getByText("added").closest("div");
    const keepRow = screen.getByText("keep").closest("div");
    const deletedARow = screen.getByText("a").closest("div");
    const deletedBRow = screen.getByText("b").closest("div");
    const deletedCRow = screen.getByText("c").closest("div");

    expect(addedRow?.className).toContain("border-t-[var(--color-accent-green)]");
    expect(addedRow?.className).toContain("border-b-[var(--color-accent-green)]");
    expect(keepRow?.className).not.toContain("border-t-[var(--color-accent-green)]");
    expect(keepRow?.className).not.toContain("border-b-[var(--color-accent-green)]");
    expect(deletedARow?.className).toContain("border-t-[var(--color-accent-red)]");
    expect(deletedBRow?.className).not.toContain("border-t-[var(--color-accent-red)]");
    expect(deletedBRow?.className).not.toContain("border-b-[var(--color-accent-red)]");
    expect(deletedCRow?.className).toContain("border-b-[var(--color-accent-red)]");
  });

  it("ends a changed block before an adjacent block of the other type", () => {
    render(
      <CodeViewer
        content={`added`}
        diffContent={`@@ -1 +1 @@\n-old\n+added`}
        mode="diff"
      />,
    );

    const deletedRow = screen.getByText("old").closest("div");
    const addedRow = screen.getByText("added").closest("div");

    expect(deletedRow?.className).toContain("border-t-[var(--color-accent-red)]");
    expect(deletedRow?.className).toContain("border-b-[var(--color-accent-red)]");
    expect(addedRow?.className).not.toContain("border-t-[var(--color-accent-green)]");
    expect(addedRow?.className).toContain("border-b-[var(--color-accent-green)]");
  });
});
