import { useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";

const DEFAULT_BOTTOM_TOLERANCE_PX = 24;

type ScrollableLayoutProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  stickToBottom?: boolean;
};

export function ScrollableLayout({ children, footer, header, stickToBottom = false }: ScrollableLayoutProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);
  const isAtBottomRef = useRef(true);

  const updateIsAtBottom = useCallback(() => {
    const contentEl = contentRef.current;

    if (!contentEl) {
      isAtBottomRef.current = true;
      return;
    }

    const remainingScroll = contentEl.scrollHeight - contentEl.scrollTop - contentEl.clientHeight;
    isAtBottomRef.current = remainingScroll <= DEFAULT_BOTTOM_TOLERANCE_PX;
  }, []);

  const scrollToBottom = useCallback(() => {
    const contentEl = contentRef.current;

    if (!contentEl) {
      return;
    }

    contentEl.scrollTop = contentEl.scrollHeight;
    isAtBottomRef.current = true;
    hasLoadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!stickToBottom) {
      return;
    }

    const contentEl = contentRef.current;

    if (!contentEl) {
      return;
    }

    updateIsAtBottom();
    contentEl.addEventListener("scroll", updateIsAtBottom);

    return () => contentEl.removeEventListener("scroll", updateIsAtBottom);
  }, [stickToBottom, updateIsAtBottom]);

  useEffect(() => {
    if (!stickToBottom) {
      return;
    }

    if (hasLoadedRef.current && !isAtBottomRef.current) {
      return;
    }

    const frame = window.requestAnimationFrame(scrollToBottom);

    return () => window.cancelAnimationFrame(frame);
  }, [children, scrollToBottom, stickToBottom]);

  useEffect(() => {
    if (!stickToBottom) {
      return;
    }

    const handleResize = () => {
      if (!isAtBottomRef.current) {
        return;
      }

      window.requestAnimationFrame(scrollToBottom);
    };

    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
    };
  }, [scrollToBottom, stickToBottom]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header ? <div className="border-b-2 border-black px-6 sm:px-8">{header}</div> : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" ref={contentRef}>
        {children}
      </div>
      {footer ? <footer className="mt-auto">{footer}</footer> : null}
    </div>
  );
}
