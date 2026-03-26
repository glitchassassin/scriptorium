import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { useRef, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScrollableLayout } from "~/components/shell/scrollable-layout";
import { useStickyBottomScroll } from "~/components/shell/use-sticky-bottom-scroll";

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
    this.callback(
      [
        {
          contentRect: { height } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  }
}

const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
const originalResizeObserver = globalThis.ResizeObserver;

function StickyBottomHarness({ children, scrollContextKey }: { children?: ReactNode; scrollContextKey?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useStickyBottomScroll({ contentRef, scrollContextKey, scrollRef });

  return (
    <ScrollableLayout contentRef={contentRef} scrollRef={scrollRef}>
      {children ?? <div>streaming message</div>}
    </ScrollableLayout>
  );
}

describe("useStickyBottomScroll", () => {
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

  async function renderHarness(props: { children?: ReactNode; scrollContextKey?: string } = {}) {
    flushSync(() => {
      root.render(<StickyBottomHarness children={props.children} scrollContextKey={props.scrollContextKey} />);
    });

    await new Promise((resolve) => window.setTimeout(resolve, 0));

    const scrollEl = container.querySelector(".overflow-y-auto");

    if (!(scrollEl instanceof HTMLElement)) {
      throw new Error("Missing scroll element");
    }

    return scrollEl;
  }

  it("sticks to the bottom when content grows and the user is already near the bottom", async () => {
    const scrollEl = await renderHarness();

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
    const scrollEl = await renderHarness();

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

  it("resets to the bottom when the scroll context changes", async () => {
    const scrollEl = await renderHarness({ scrollContextKey: "transcript:one" });

    mockElementMetrics(scrollEl, {
      clientHeight: 200,
      scrollHeight: 1000,
      scrollTop: 500,
    });
    scrollEl.dispatchEvent(new Event("scroll"));

    flushSync(() => {
      root.render(<StickyBottomHarness scrollContextKey="transcript:two" />);
    });

    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(scrollEl.scrollTop).toBe(1000);
  });
});
