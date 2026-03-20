import { useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";

const DEFAULT_BOTTOM_TOLERANCE_PX = 70;

type ScrollableLayoutProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  stickToBottom?: boolean;
};

export function ScrollableLayout({ children, footer, header, stickToBottom = false }: ScrollableLayoutProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);
  const isNearBottomRef = useRef(true);

  const updateIsNearBottom = useCallback(() => {
    const scrollEl = scrollRef.current;

    if (!scrollEl) {
      isNearBottomRef.current = true;
      return;
    }

    const remainingScroll = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
    isNearBottomRef.current = remainingScroll <= DEFAULT_BOTTOM_TOLERANCE_PX;
  }, []);

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
    if (!stickToBottom) {
      return;
    }

    const scrollEl = scrollRef.current;

    if (!scrollEl) {
      return;
    }

    updateIsNearBottom();
    scrollEl.addEventListener("scroll", updateIsNearBottom);

    return () => scrollEl.removeEventListener("scroll", updateIsNearBottom);
  }, [stickToBottom, updateIsNearBottom]);

  useEffect(() => {
    if (!stickToBottom) {
      return;
    }

    if (hasLoadedRef.current && !isNearBottomRef.current) {
      return;
    }

    const frame = window.requestAnimationFrame(scrollToBottom);

    return () => window.cancelAnimationFrame(frame);
  }, [children, scrollToBottom, stickToBottom]);

  useEffect(() => {
    if (!stickToBottom) {
      return;
    }

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
  }, [scrollToBottom, stickToBottom]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header ? <div className="border-b-2 border-black px-6 sm:px-8">{header}</div> : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" ref={scrollRef}>
        <div className="flex min-h-full flex-1 flex-col" ref={contentRef}>
          {children}
        </div>
      </div>
      {footer ? <footer className="mt-auto">{footer}</footer> : null}
    </div>
  );
}
