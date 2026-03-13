import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from "react";

type IndicatorDragState = {
  offsetY: number;
  pointerId: number;
};

const MIN_INDICATOR_THUMB_HEIGHT = 24;

function measureIndicatorMetrics(scrollEl: HTMLElement, railEl: HTMLElement) {
  const railHeight = railEl.clientHeight;
  const maxScrollTop = Math.max(scrollEl.scrollHeight - scrollEl.clientHeight, 0);

  if (railHeight <= 0 || maxScrollTop <= 0 || scrollEl.scrollHeight <= scrollEl.clientHeight) {
    return { topPx: 0, heightPx: railHeight };
  }

  const visibleRatio = scrollEl.clientHeight / scrollEl.scrollHeight;
  const heightPx = Math.min(Math.max(railHeight * visibleRatio, MIN_INDICATOR_THUMB_HEIGHT), railHeight);
  const availableTrack = Math.max(railHeight - heightPx, 0);
  const topPx = availableTrack * (scrollEl.scrollTop / maxScrollTop);

  return { topPx, heightPx };
}

function applyIndicatorMetrics(thumbEl: HTMLElement, scrollEl: HTMLElement, railEl: HTMLElement) {
  const { topPx, heightPx } = measureIndicatorMetrics(scrollEl, railEl);
  thumbEl.style.top = `${topPx}px`;
  thumbEl.style.height = `${heightPx}px`;
}

function scrollToIndicatorOffset(scrollEl: HTMLElement, railEl: HTMLElement, thumbTop: number) {
  const railHeight = railEl.clientHeight;
  const maxScrollTop = Math.max(scrollEl.scrollHeight - scrollEl.clientHeight, 0);

  if (railHeight <= 0 || maxScrollTop <= 0) {
    scrollEl.scrollTo({ top: 0 });
    return;
  }

  const { heightPx } = measureIndicatorMetrics(scrollEl, railEl);
  const availableTrack = Math.max(railHeight - heightPx, 0);
  const clampedTop = Math.min(Math.max(thumbTop, 0), availableTrack);
  const ratio = availableTrack > 0 ? clampedTop / availableTrack : 0;

  scrollEl.scrollTo({ top: ratio * maxScrollTop });
}

function scrollToRailPosition(scrollEl: HTMLElement, railEl: HTMLElement, clientY: number) {
  const railRect = railEl.getBoundingClientRect();
  const { heightPx } = measureIndicatorMetrics(scrollEl, railEl);
  const clickOffset = clientY - railRect.top;
  scrollToIndicatorOffset(scrollEl, railEl, clickOffset - heightPx / 2);
}

export function useScrollIndicator(dependencies: unknown[]) {
  const scrollPaneRef = useRef<HTMLDivElement | null>(null);
  const indicatorRailRef = useRef<HTMLButtonElement | null>(null);
  const indicatorThumbRef = useRef<HTMLSpanElement | null>(null);
  const indicatorFrameRef = useRef<number | null>(null);
  const indicatorDragRef = useRef<IndicatorDragState | null>(null);
  const suppressRailClickRef = useRef(false);

  const scheduleIndicatorSync = useCallback(() => {
    if (indicatorFrameRef.current !== null) {
      cancelAnimationFrame(indicatorFrameRef.current);
    }

    indicatorFrameRef.current = requestAnimationFrame(() => {
      indicatorFrameRef.current = null;

      const scrollEl = scrollPaneRef.current;
      const railEl = indicatorRailRef.current;
      const thumbEl = indicatorThumbRef.current;

      if (!scrollEl || !railEl || !thumbEl) {
        return;
      }

      applyIndicatorMetrics(thumbEl, scrollEl, railEl);
    });
  }, []);

  const handleIndicatorClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (suppressRailClickRef.current) {
        suppressRailClickRef.current = false;
        return;
      }

      const scrollEl = scrollPaneRef.current;
      const railEl = indicatorRailRef.current;

      if (!scrollEl || !railEl) {
        return;
      }

      scrollToRailPosition(scrollEl, railEl, event.clientY);
      scheduleIndicatorSync();
    },
    [scheduleIndicatorSync],
  );

  const handleIndicatorDragMove = useCallback(
    (event: globalThis.PointerEvent) => {
      const dragState = indicatorDragRef.current;
      const scrollEl = scrollPaneRef.current;
      const railEl = indicatorRailRef.current;

      if (!dragState || dragState.pointerId !== event.pointerId || !scrollEl || !railEl) {
        return;
      }

      const railRect = railEl.getBoundingClientRect();
      scrollToIndicatorOffset(scrollEl, railEl, event.clientY - railRect.top - dragState.offsetY);
      scheduleIndicatorSync();
    },
    [scheduleIndicatorSync],
  );

  const stopIndicatorDrag = useCallback(() => {
    indicatorDragRef.current = null;
    suppressRailClickRef.current = true;
    window.removeEventListener("pointermove", handleIndicatorDragMove);
    window.removeEventListener("pointerup", stopIndicatorDrag);
    window.removeEventListener("pointercancel", stopIndicatorDrag);
  }, [handleIndicatorDragMove]);

  const handleIndicatorThumbPointerDown = useCallback(
    (event: PointerEvent<HTMLSpanElement>) => {
      const railEl = indicatorRailRef.current;
      const thumbEl = indicatorThumbRef.current;

      if (!railEl || !thumbEl) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const thumbRect = thumbEl.getBoundingClientRect();
      indicatorDragRef.current = {
        offsetY: event.clientY - thumbRect.top,
        pointerId: event.pointerId,
      };
      suppressRailClickRef.current = false;

      window.addEventListener("pointermove", handleIndicatorDragMove);
      window.addEventListener("pointerup", stopIndicatorDrag);
      window.addEventListener("pointercancel", stopIndicatorDrag);
    },
    [handleIndicatorDragMove, stopIndicatorDrag],
  );

  useEffect(() => {
    const scrollEl = scrollPaneRef.current;
    const railEl = indicatorRailRef.current;

    if (!scrollEl || !railEl) {
      return;
    }

    scheduleIndicatorSync();

    const handleScroll = () => {
      scheduleIndicatorSync();
    };

    scrollEl.addEventListener("scroll", handleScroll, { passive: true });

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            scheduleIndicatorSync();
          });

    resizeObserver?.observe(scrollEl);
    resizeObserver?.observe(railEl);
    window.addEventListener("resize", scheduleIndicatorSync);

    return () => {
      stopIndicatorDrag();
      scrollEl.removeEventListener("scroll", handleScroll);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleIndicatorSync);

      if (indicatorFrameRef.current !== null) {
        cancelAnimationFrame(indicatorFrameRef.current);
        indicatorFrameRef.current = null;
      }
    };
  }, [scheduleIndicatorSync, stopIndicatorDrag, ...dependencies]);

  return {
    scrollPaneRef,
    indicatorRailRef,
    indicatorThumbRef,
    handleIndicatorClick,
    handleIndicatorThumbPointerDown,
  };
}
