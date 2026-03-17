import type { ReactNode } from "react";

import { cn } from "~/lib/cn";

import styles from "../code-viewer.module.css";

type CodeViewerFrameProps = {
  children: ReactNode;
};

export function CodeViewerFrame({ children }: CodeViewerFrameProps) {
  return (
    <section className={cn(styles.root, "relative flex min-h-0 min-w-0 flex-1 bg-white text-sm leading-6")}>
      <div className="relative flex min-h-0 min-w-0 flex-1">{children}</div>
    </section>
  );
}
