import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ScrollableLayout } from "~/components/shell/scrollable-layout";

describe("ScrollableLayout", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  it("renders header, footer, and children in a single scroll container", async () => {
    flushSync(() => {
      root.render(
        <ScrollableLayout footer={<div>Footer</div>} header={<div>Header</div>}>
          <div>Content</div>
        </ScrollableLayout>,
      );
    });

    await new Promise((resolve) => window.setTimeout(resolve, 0));

    const scrollEl = container.querySelector(".overflow-y-auto");

    if (!(scrollEl instanceof HTMLElement)) {
      throw new Error("Missing scroll element");
    }
    expect(container.textContent).toContain("Header");
    expect(container.textContent).toContain("Content");
    expect(container.textContent).toContain("Footer");
    expect(scrollEl.querySelector("div > div")?.textContent).toContain("Content");
  });
});
