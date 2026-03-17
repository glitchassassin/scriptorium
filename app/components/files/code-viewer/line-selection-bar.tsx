import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

type LineSelectionBarProps = {
  onClear: () => void;
  onInsert: () => void;
  range: {
    start: number;
    end: number;
  };
};

function formatSelectedLines(range: { start: number; end: number }) {
  const start = Math.min(range.start, range.end);
  const end = Math.max(range.start, range.end);

  return start === end ? `${start}` : `${start}-${end}`;
}

export function LineSelectionBar({ onClear, onInsert, range }: LineSelectionBarProps) {
  return (
    <div className="pointer-events-auto inline-flex items-center gap-0 bg-white">
      <button
        aria-label="Insert selected line reference"
        className="inline-flex min-h-11 min-w-11 items-center justify-center bg-black text-white"
        onClick={onInsert}
        type="button"
      >
        <Icon className="size-5" icon="mdi:arrow-down" />
      </button>
      <button
        aria-label="Clear selected lines"
        className="inline-flex min-h-11 min-w-11 items-center justify-center border-2 border-black bg-white"
        onClick={onClear}
        type="button"
      >
        <Icon className="size-5" icon="mdi:close" />
      </button>
      <span className="inline-flex min-h-11 items-center border-2 border-l-0 border-black px-3 text-sm leading-6">
        {formatSelectedLines(range)}
      </span>
    </div>
  );
}
