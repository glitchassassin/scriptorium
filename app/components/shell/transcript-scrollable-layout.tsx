import { useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { ScrollableLayout } from "~/components/shell/scrollable-layout";

const DEFAULT_BOTTOM_TOLERANCE_PX = 70;
const DEFAULT_TOP_TOLERANCE_PX = 8;

type TranscriptScrollableLayoutProps = {
  children: ReactNode;
  footer?: ReactNode;
  header?: ReactNode;
  onReachTop?: () => void;
  scrollContextKey?: string;
};

export function TranscriptScrollableLayout({
  children,
  footer,
  header,
  onReachTop,
  scrollContextKey,
}: TranscriptScrollableLayoutProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const hasReachedTopRef = useRef(false);

  useEffect(() => {
    hasLoadedRef.current = false;
    isNearBottomRef.current = true;
    hasReachedTopRef.current = false;
  }, [scrollContextKey]);

  const updateScrollState = useCallback(() => {
    const scrollEl = scrollRef.current;

    if (!scrollEl) {
      isNearBottomRef.current = true;
      hasReachedTopRef.current = false;
      return;
    }

    const remainingScroll = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
    isNearBottomRef.current = remainingScroll <= DEFAULT_BOTTOM_TOLERANCE_PX;
    const isOverflowing = scrollEl.scrollHeight > scrollEl.clientHeight;
    const isNearTop = isOverflowing && scrollEl.scrollTop <= DEFAULT_TOP_TOLERANCE_PX;

    if (isNearTop && !hasReachedTopRef.current) {
      hasReachedTopRef.current = true;
      onReachTop?.();
      return;
    }

    if (!isNearTop) {
      hasReachedTopRef.current = false;
    }
  }, [onReachTop]);

  const scrollToBottom = useCallback(() => {
    const scrollEl = scrollRef.current;

    if (!scrollEl) {
      return;
    }

    scrollEl.scrollTop = scrollEl.scrollHeight;
    isNearBottomRef.current = true;
    hasLoadedRef.current = true;
  }, []);

  useEffect(() => {
    const scrollEl = scrollRef.current;

    if (!scrollEl) {
      return;
    }

    updateScrollState();
    scrollEl.addEventListener("scroll", updateScrollState);

    return () => scrollEl.removeEventListener("scroll", updateScrollState);
  }, [onReachTop, updateScrollState]);

  useEffect(() => {
    if (hasLoadedRef.current && !isNearBottomRef.current) {
      return;
    }

    const frame = window.requestAnimationFrame(scrollToBottom);

    return () => window.cancelAnimationFrame(frame);
  }, [children, scrollContextKey, scrollToBottom]);

  useEffect(() => {
    const contentEl = contentRef.current;

    if (!contentEl || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (!isNearBottomRef.current) {
        return;
      }

      window.requestAnimationFrame(scrollToBottom);
    });

    observer.observe(contentEl);

    return () => {
      observer.disconnect();
    };
  }, [scrollToBottom]);

  return (
    <ScrollableLayout contentRef={contentRef} footer={footer} header={header} scrollRef={scrollRef}>
      {children}
    </ScrollableLayout>
  );
}
