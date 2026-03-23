import type { ReactNode, RefObject } from "react";

type ScrollableLayoutProps = {
  children: ReactNode;
  contentRef?: RefObject<HTMLDivElement | null>;
  header?: ReactNode;
  footer?: ReactNode;
  scrollRef?: RefObject<HTMLDivElement | null>;
};

export function ScrollableLayout({ children, contentRef, footer, header, scrollRef }: ScrollableLayoutProps) {
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
