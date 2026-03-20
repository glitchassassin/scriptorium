import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScrollableLayout } from "~/components/shell/scrollable-layout";

function mockElementMetrics(element: HTMLElement, metrics: Partial<HTMLElement>) {
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
}

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = [];

  callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ResizeObserverMock.instances.push(this);
  }

  disconnect() {}

  observe() {}

  unobserve() {}

  trigger(height: number) {
    this.callback([
      {
        contentRect: { height } as DOMRectReadOnly,
      } as ResizeObserverEntry,
    ], this as unknown as ResizeObserver);
  }
}

const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
const originalResizeObserver = globalThis.ResizeObserver;

describe("ScrollableLayout", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    ResizeObserverMock.instances = [];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = vi.fn();
    globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    globalThis.ResizeObserver = originalResizeObserver;
  });

  async function renderLayout() {
    flushSync(() => {
      root.render(
        <ScrollableLayout stickToBottom>
          <div>streaming message</div>
        </ScrollableLayout>,
      );
    });

    await new Promise((resolve) => window.setTimeout(resolve, 0));

    const scrollEl = container.querySelector(".overflow-y-auto");

    if (!(scrollEl instanceof HTMLElement)) {
      throw new Error("Missing scroll element");
    }

    return scrollEl;
  }

  it("sticks to the bottom when content grows and the user is already near the bottom", async () => {
    const scrollEl = await renderLayout();

    mockElementMetrics(scrollEl, {
      clientHeight: 200,
      scrollHeight: 1000,
      scrollTop: 760,
    });
    scrollEl.dispatchEvent(new Event("scroll"));

    mockElementMetrics(scrollEl, {
      scrollHeight: 1200,
    });

    ResizeObserverMock.instances[0]?.trigger(1200);

    expect(scrollEl.scrollTop).toBe(1200);
  });

  it("does not yank scroll position when content grows and the user has scrolled up", async () => {
    const scrollEl = await renderLayout();

    mockElementMetrics(scrollEl, {
      clientHeight: 200,
      scrollHeight: 1000,
      scrollTop: 500,
    });
    scrollEl.dispatchEvent(new Event("scroll"));

    mockElementMetrics(scrollEl, {
      scrollHeight: 1200,
    });

    ResizeObserverMock.instances[0]?.trigger(1200);

    expect(scrollEl.scrollTop).toBe(500);
  });

  it("calls onReachTop once per boundary crossing", async () => {
    const onReachTop = vi.fn();

    flushSync(() => {
      root.render(
        <ScrollableLayout onReachTop={onReachTop}>
          <div>history</div>
        </ScrollableLayout>,
      );
    });

    await new Promise((resolve) => window.setTimeout(resolve, 0));

    const scrollEl = container.querySelector(".overflow-y-auto");

    if (!(scrollEl instanceof HTMLElement)) {
      throw new Error("Missing scroll element");
    }

    mockElementMetrics(scrollEl, {
      clientHeight: 200,
      scrollHeight: 1000,
      scrollTop: 24,
    });
    scrollEl.dispatchEvent(new Event("scroll"));

    mockElementMetrics(scrollEl, {
      scrollTop: 0,
    });
    scrollEl.dispatchEvent(new Event("scroll"));
    scrollEl.dispatchEvent(new Event("scroll"));

    mockElementMetrics(scrollEl, {
      scrollTop: 40,
    });
    scrollEl.dispatchEvent(new Event("scroll"));

    mockElementMetrics(scrollEl, {
      scrollTop: 0,
    });
    scrollEl.dispatchEvent(new Event("scroll"));

    expect(onReachTop).toHaveBeenCalledTimes(2);
  });

});
