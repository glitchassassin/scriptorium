import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CodeViewer } from "~/components/files/code-viewer";

function mockElementMetrics(element: HTMLElement, metrics: Partial<HTMLElement> & { rectTop?: number } = {}) {
  if ("clientHeight" in metrics && metrics.clientHeight !== undefined) {
    Object.defineProperty(element, "clientHeight", {
      configurable: true,
      value: metrics.clientHeight,
    });
  }

  if ("scrollHeight" in metrics && metrics.scrollHeight !== undefined) {
    Object.defineProperty(element, "scrollHeight", {
      configurable: true,
      value: metrics.scrollHeight,
    });
  }

  if ("scrollTop" in metrics && metrics.scrollTop !== undefined) {
    Object.defineProperty(element, "scrollTop", {
      configurable: true,
      writable: true,
      value: metrics.scrollTop,
    });
  }

  if (metrics.rectTop !== undefined) {
    element.getBoundingClientRect = vi.fn(() => ({
      bottom: metrics.rectTop! + (metrics.clientHeight ?? 0),
      height: metrics.clientHeight ?? 0,
      left: 0,
      right: 0,
      top: metrics.rectTop!,
      width: 0,
      x: 0,
      y: metrics.rectTop!,
      toJSON: () => ({}),
    }));
  }
}

describe("CodeViewer", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("renders grouped change markers in diff mode", () => {
    render(
      <CodeViewer
        content={`new\nshared\nplus one\nplus two`}
        diffContent={`@@ -1,4 +1,4 @@\n-old\n+new\n shared\n+plus one\n+plus two\n-removed`}
        mode="diff"
      />,
    );

    expect(screen.getAllByTestId("code-viewer-change-marker-addition")).toHaveLength(2);
    expect(screen.getAllByTestId("code-viewer-change-marker-deletion")).toHaveLength(2);
  });

  it("does not render change markers in text mode", () => {
    render(<CodeViewer content={`alpha\nbeta`} />);

    expect(screen.queryByTestId("code-viewer-change-marker-addition")).not.toBeInTheDocument();
    expect(screen.queryByTestId("code-viewer-change-marker-deletion")).not.toBeInTheDocument();
  });

  it("scrolls the pane when the indicator rail is clicked", () => {
    render(<CodeViewer content={Array.from({ length: 50 }, (_, index) => `line ${index + 1}`).join("\n")} />);

    const rail = screen.getByRole("button", { name: "Scroll to a position in the file" });
    const thumb = screen.getByTestId("code-viewer-scroll-thumb");
    const scrollPane = rail.closest("div")?.previousElementSibling as HTMLDivElement;
    const scrollTo = vi.fn();

    mockElementMetrics(scrollPane, {
      clientHeight: 200,
      scrollHeight: 1000,
      scrollTop: 0,
    });
    mockElementMetrics(rail, {
      clientHeight: 160,
      rectTop: 20,
    });
    scrollPane.scrollTo = scrollTo;

    fireEvent.click(rail, { clientY: 100 });

    expect(scrollTo).toHaveBeenCalledWith({ top: 400 });
    expect(thumb).toHaveStyle({ top: "0px", height: "32px" });
  });

  it("drags the thumb to scroll the pane", () => {
    render(<CodeViewer content={Array.from({ length: 50 }, (_, index) => `line ${index + 1}`).join("\n")} />);

    const rail = screen.getByRole("button", { name: "Scroll to a position in the file" });
    const thumb = screen.getByTestId("code-viewer-scroll-thumb");
    const scrollPane = rail.closest("div")?.previousElementSibling as HTMLDivElement;
    const scrollTo = vi.fn();

    mockElementMetrics(scrollPane, {
      clientHeight: 200,
      scrollHeight: 1000,
      scrollTop: 0,
    });
    mockElementMetrics(rail, {
      clientHeight: 160,
      rectTop: 20,
    });
    mockElementMetrics(thumb, {
      clientHeight: 32,
      rectTop: 20,
    });
    scrollPane.scrollTo = scrollTo;

    fireEvent.pointerDown(thumb, { clientY: 30, pointerId: 1 });
    fireEvent.pointerMove(window, { clientY: 110, pointerId: 1 });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(scrollTo).toHaveBeenCalledWith({ top: 500 });
  });

  it("fills the indicator rail when content does not overflow", () => {
    render(<CodeViewer content={`only line`} />);

    const rail = screen.getByRole("button", { name: "Scroll to a position in the file" });
    const thumb = screen.getByTestId("code-viewer-scroll-thumb");
    const scrollPane = rail.closest("div")?.previousElementSibling as HTMLDivElement;

    mockElementMetrics(scrollPane, {
      clientHeight: 200,
      scrollHeight: 200,
      scrollTop: 0,
    });
    mockElementMetrics(rail, {
      clientHeight: 160,
      rectTop: 20,
    });

    fireEvent.scroll(scrollPane);

    expect(thumb).toHaveStyle({ top: "0px", height: "160px" });
  });
});
