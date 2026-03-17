import type { ReactNode } from "react";

import { useScrollIndicator } from "~/components/files/code-viewer/use-scroll-indicator";
import type { ChangeMarker, ViewMode } from "./types";

type ScrollIndicatorProps = {
  children: (props: { indicator: ReactNode; scrollPaneRef: ReturnType<typeof useScrollIndicator>["scrollPaneRef"] }) => ReactNode;
  mode: ViewMode;
  changeMarkers: ChangeMarker[];
};

export function ScrollIndicator({
  children,
  mode,
  changeMarkers,
}: ScrollIndicatorProps) {
  const { scrollPaneRef, indicatorRailRef, indicatorThumbRef, handleIndicatorClick, handleIndicatorThumbPointerDown } =
    useScrollIndicator([changeMarkers]);

  const indicator = (
    <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-10 pb-4">
      <button
        type="button"
        ref={indicatorRailRef}
        data-testid="code-viewer-scroll-indicator"
        className="pointer-events-auto relative h-full min-h-11 w-full p-0"
        aria-label="Scroll to a position in the file"
        onClick={handleIndicatorClick}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 bottom-0 left-1/2 w-3 -translate-x-1/2 border-2 border-black bg-white"
        />
        {mode === "diff"
          ? changeMarkers.map((marker, index) => (
              <span
                key={`${marker.kind}-${index}`}
                data-testid={`code-viewer-change-marker-${marker.kind}`}
                aria-hidden="true"
                className={`pointer-events-none absolute top-0 left-1/2 block min-h-1.5 w-3 -translate-x-1/2 border-y-2 border-black ${
                  marker.kind === "addition" ? "bg-[var(--color-accent-green)]" : "bg-[var(--color-accent-red)]"
                }`}
                style={{ top: `${marker.top * 100}%`, height: `${marker.height * 100}%` }}
              />
            ))
          : null}
        <span
          ref={indicatorThumbRef}
          data-testid="code-viewer-scroll-thumb"
          className="absolute top-0 left-1/2 block w-8 -translate-x-1/2 cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={handleIndicatorThumbPointerDown}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-1/2 w-5 -translate-x-1/2 border-2 border-black bg-transparent"
          />
        </span>
      </button>
    </div>
  );

  return children({ indicator, scrollPaneRef });
}
