import { useState } from "react";
import type { ReactNode } from "react";

import { LineSelectionBar } from "~/components/files/code-viewer/line-selection-bar";
import type { CodeViewerLineSelection, CodeViewerProps } from "~/components/files/code-viewer/types";

type LineRange = {
  start: number;
  end: number;
};

type RowRange = {
  start: number;
  end: number;
};

type LineSelectionLayerProps = {
  children: (props: {
    onSelectLine?: CodeViewerProps["onSelectLine"];
    selectedRowRange: CodeViewerProps["selectedRowRange"];
  }) => ReactNode;
  onInsert?: (range: LineRange) => void;
};

export function LineSelectionLayer({
  children,
  onInsert,
}: LineSelectionLayerProps) {
  const [selectionAnchor, setSelectionAnchor] = useState<CodeViewerLineSelection | null>(null);
  const [selectedLineRange, setSelectedLineRange] = useState<LineRange | null>(null);
  const [selectedRowRange, setSelectedRowRange] = useState<RowRange | null>(null);

  const clearSelection = () => {
    setSelectionAnchor(null);
    setSelectedLineRange(null);
    setSelectedRowRange(null);
  };

  const handleLineSelect = (selection: CodeViewerLineSelection) => {
    if (!selectionAnchor) {
      setSelectionAnchor(selection);
      setSelectedLineRange(
        selection.currentFileLine === null
          ? null
          : { start: selection.currentFileLine, end: selection.currentFileLine },
      );
      setSelectedRowRange({ start: selection.rowIndex, end: selection.rowIndex });
      return;
    }

    setSelectedLineRange(
      selectionAnchor.currentFileLine === null || selection.currentFileLine === null
        ? null
        : { start: selectionAnchor.currentFileLine, end: selection.currentFileLine },
    );
    setSelectedRowRange({ start: selectionAnchor.rowIndex, end: selection.rowIndex });
  };

  const handleInsert = () => {
    if (!onInsert || !selectedLineRange) {
      return;
    }

    onInsert(selectedLineRange);
    clearSelection();
  };

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1">
      {children({
        onSelectLine: handleLineSelect,
        selectedRowRange,
      })}
      {Boolean(selectedLineRange) && (
        <div className="pointer-events-none absolute bottom-4 left-8 z-10">
          <LineSelectionBar onClear={clearSelection} onInsert={handleInsert} range={selectedLineRange!} />
        </div>
      )}
    </div>
  );
}
