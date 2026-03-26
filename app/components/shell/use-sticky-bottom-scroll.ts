import { useCallback, useEffect, useRef, type RefObject } from "react";

const DEFAULT_BOTTOM_TOLERANCE_PX = 70;

type UseStickyBottomScrollOptions = {
  contentRef: RefObject<HTMLDivElement | null>;
  scrollContextKey?: string;
  scrollRef: RefObject<HTMLDivElement | null>;
};

export function useStickyBottomScroll({ contentRef, scrollContextKey, scrollRef }: UseStickyBottomScrollOptions) {
  const hasLoadedRef = useRef(false);
  const isNearBottomRef = useRef(true);

  const updateScrollState = useCallback(() => {
    const scrollEl = scrollRef.current;

    if (!scrollEl) {
      isNearBottomRef.current = true;
      return;
    }

    const remainingScroll = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;

    isNearBottomRef.current = remainingScroll <= DEFAULT_BOTTOM_TOLERANCE_PX;
  }, [scrollRef]);

  const scrollToBottom = useCallback(() => {
    const scrollEl = scrollRef.current;

    if (!scrollEl) {
      return;
    }

    scrollEl.scrollTop = scrollEl.scrollHeight;
    isNearBottomRef.current = true;
    hasLoadedRef.current = true;
  }, [scrollRef]);

  useEffect(() => {
    hasLoadedRef.current = false;
    isNearBottomRef.current = true;

    const frame = window.requestAnimationFrame(scrollToBottom);

    return () => window.cancelAnimationFrame(frame);
  }, [scrollContextKey, scrollToBottom]);

  useEffect(() => {
    const scrollEl = scrollRef.current;

    if (!scrollEl) {
      return;
    }

    updateScrollState();
    scrollEl.addEventListener("scroll", updateScrollState);

    return () => scrollEl.removeEventListener("scroll", updateScrollState);
  }, [scrollContextKey, scrollRef, updateScrollState]);

  useEffect(() => {
    const contentEl = contentRef.current;

    if (!contentEl || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (hasLoadedRef.current && !isNearBottomRef.current) {
        return;
      }

      window.requestAnimationFrame(scrollToBottom);
    });

    observer.observe(contentEl);

    return () => {
      observer.disconnect();
    };
  }, [contentRef, scrollToBottom]);
}
