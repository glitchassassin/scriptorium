export type ViewMode = "text" | "diff";
export type DiffSide = "old" | "new";
export type LineKind = "text" | "context" | "addition" | "deletion";
export type ChunkTone = "addition" | "deletion" | null;

export type ViewLine = {
  key: string;
  kind: LineKind;
  content: string;
  currentFileLine: number | null;
  leftLine: number | null;
  rightLine: number | null;
  marker: string;
  chunkStartTone: ChunkTone;
  chunkEndTone: ChunkTone;
};

export type ChangeMarker = {
  kind: "addition" | "deletion";
  top: number;
  height: number;
};

export type CodeViewerLineSelection = {
  currentFileLine: number | null;
  rowIndex: number;
};

export type CodeViewerProps = {
  content: string;
  diffContent?: string;
  diffSide?: DiffSide;
  fileName?: string;
  language?: string | null;
  mode?: ViewMode;
  onSelectLine?: (selection: CodeViewerLineSelection) => void;
  scrollToRowIndex?: number | null;
  scrollToRowKey?: string | null;
  selectedRowRange?: {
    start: number;
    end: number;
  } | null;
  showLineNumbers?: boolean;
  showDiffMarkers?: boolean;
  showScrollIndicator?: boolean;
};
