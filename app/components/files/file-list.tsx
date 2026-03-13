import { useEffect, useState } from "react";

import type {
  FileBrowserEntry,
  FileBrowserSelection,
  FileBrowserSelectionMode,
} from "~/lib/instances/types";

type FileListProps = {
  currentPath: string;
  parentPath: string | null;
  entries: FileBrowserEntry[];
  selectionMode?: FileBrowserSelectionMode;
  label?: string;
  name?: string;
  value?: string | null;
  selectedPath?: string | null;
  isLoading?: boolean;
  onBrowseTo?: (path: string) => void;
  onSelectionChange?: (selection: FileBrowserSelection | null) => void;
  emptyLabel?: string;
  getItemPrefix?: (entry: FileBrowserEntry) => string | null;
  getItemDescription?: (entry: FileBrowserEntry) => string | null;
};

function getName(path: string) {
  return path.split("/").filter(Boolean).at(-1) || path;
}

export function SingleColumnFileList({
  currentPath,
  parentPath,
  entries,
  selectionMode = "either",
  label,
  name,
  value = null,
  selectedPath,
  isLoading = false,
  onBrowseTo,
  onSelectionChange,
  emptyLabel = "This folder is empty.",
  getItemPrefix,
  getItemDescription,
}: FileListProps) {
  const canSelectCurrentDirectory = selectionMode === "directory" || selectionMode === "either";
  const [selected, setSelected] = useState<FileBrowserSelection | null>(
    value
      ? {
          path: value,
          type: "directory",
          name: getName(value),
        }
      : null,
  );

  useEffect(() => {
    const nextPath = selectedPath ?? value;

    if (!nextPath) {
      setSelected(null);
      return;
    }

    setSelected({
      path: nextPath,
      type: "directory",
      name: getName(nextPath),
    });
  }, [selectedPath, value]);

  const effectiveSelection = selectedPath !== undefined ? selectedPath : selected?.path ?? null;
  const formValue = canSelectCurrentDirectory ? currentPath : effectiveSelection ?? "";

  function setSelection(selection: FileBrowserSelection | null) {
    setSelected(selection);
    onSelectionChange?.(selection);
  }

  return (
    <section className="space-y-3">
      {label ? <p className="text-sm uppercase tracking-[0.08em]">{label}</p> : null}
      {name ? <input name={name} type="hidden" value={formValue} /> : null}
      <div className="border-l-2 border-black" role="listbox">
        <ul className="space-y-1">
          {parentPath ? (
            <li>
              <button
                className="block min-h-9 w-full px-3 py-1 text-left text-base disabled:opacity-25"
                disabled={isLoading}
                onClick={() => onBrowseTo?.(parentPath)}
                type="button"
              >
                <p className="truncate">../</p>
              </button>
            </li>
          ) : null}
          {entries.length ? (
            entries.map((entry) => {
              const canSelectEntry =
                selectionMode === "either" ||
                (selectionMode === "directory" && entry.type === "directory") ||
                (selectionMode === "file" && entry.type === "file");
              const isSelected = effectiveSelection === entry.path;
              const description = getItemDescription?.(entry);

              return (
                <li className={isSelected ? "border-l-4 border-l-black font-bold" : ""} key={entry.path}>
                  {entry.type === "directory" ? (
                    <button
                      className="block min-h-9 w-full px-3 py-1 text-left text-base disabled:opacity-25"
                      disabled={isLoading}
                      onClick={() => onBrowseTo?.(entry.path)}
                      type="button"
                    >
                      <p className="flex min-w-0 items-baseline gap-2 truncate">
                        {getItemPrefix?.(entry) ? <span className="w-5 shrink-0">{getItemPrefix(entry)}</span> : null}
                        <span className="truncate">{entry.name}/</span>
                      </p>
                      {description ? <p className="truncate text-sm opacity-60">{description}</p> : null}
                    </button>
                  ) : canSelectEntry ? (
                    <button
                      className={`block min-h-9 w-full px-3 py-1 text-left text-base disabled:opacity-25 ${
                        isSelected ? "bg-black text-white" : ""
                      }`}
                      disabled={isLoading}
                      onClick={() =>
                        setSelection({
                          name: entry.name,
                          path: entry.path,
                          type: entry.type,
                        })
                      }
                      type="button"
                    >
                      <p className="flex min-w-0 items-baseline gap-2 truncate">
                        {getItemPrefix?.(entry) ? <span className="w-5 shrink-0">{getItemPrefix(entry)}</span> : null}
                        <span className="truncate">{entry.name}</span>
                      </p>
                      {description ? <p className="truncate text-sm opacity-60">{description}</p> : null}
                    </button>
                  ) : (
                    <div className="px-3 py-1">
                      <p className="flex min-w-0 items-baseline gap-2 truncate text-base">
                        {getItemPrefix?.(entry) ? <span className="w-5 shrink-0">{getItemPrefix(entry)}</span> : null}
                        <span className="truncate">{entry.name}</span>
                      </p>
                      {description ? <p className="truncate text-sm opacity-60">{description}</p> : null}
                    </div>
                  )}
                </li>
              );
            })
          ) : (
            <li className="min-h-11 px-3 py-2 text-base">
              {isLoading ? "Loading directory..." : emptyLabel}
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}
