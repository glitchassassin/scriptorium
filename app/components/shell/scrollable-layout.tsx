import type { ReactNode } from "react";

type ScrollableLayoutProps = {
  children: ReactNode;
  footer?: ReactNode;
};

export function ScrollableLayout({ children, footer }: ScrollableLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto py-6">
        {children}
      </div>
      {footer ? <footer className="mt-auto py-4">{footer}</footer> : null}
    </div>
  );
}
