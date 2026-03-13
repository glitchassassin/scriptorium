import type { ReactNode } from "react";

type ScrollableLayoutProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
};

export function ScrollableLayout({ children, footer, header }: ScrollableLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header ? <div className="border-b-2 border-black/50">{header}</div> : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-6">
        {children}
      </div>
      {footer ? <footer className="mt-auto py-4">{footer}</footer> : null}
    </div>
  );
}
