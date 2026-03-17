import type { ReactNode } from "react";

type ScrollableLayoutProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
};

export function ScrollableLayout({ children, footer, header }: ScrollableLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header ? <div className="border-b-2 border-black px-6 sm:px-8">{header}</div> : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {children}
      </div>
      {footer ? <footer className="mt-auto px-6 py-4 sm:px-8">{footer}</footer> : null}
    </div>
  );
}
