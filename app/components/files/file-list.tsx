import type { ReactNode } from "react";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import type {
  FileBrowserSelection,
  FileBrowserSelectionMode,
  FileTreeNode,
} from "~/lib/projects/types";

type FileTreeListProps = {
  currentPath?: string | null;
  directoryErrors?: Record<string, string>;
  emptyLabel?: string;
  label?: string;
  name?: string;
  onSelectionChange?: (selection: FileBrowserSelection | null) => void;
  onToggleDirectory?: (path: string) => void;
  onRetryDirectory?: (path: string) => void;
  renderPrefix?: (node: FileTreeNode) => ReactNode;
  selectedPath?: string | null;
  selectionMode?: FileBrowserSelectionMode;
  tree: FileTreeNode[];
  value?: string | null;
  expandedPaths?: string[];
};

function isExpanded(path: string, expandedPaths: string[]) {
  return expandedPaths.includes(path);
}

export function FileTreeList({
  currentPath = null,
  directoryErrors = {},
  emptyLabel = "This folder is empty.",
  expandedPaths = [],
  label,
  name,
  onSelectionChange,
  onToggleDirectory,
  onRetryDirectory,
  renderPrefix,
  selectedPath,
  selectionMode = "either",
  tree,
  value = null,
}: FileTreeListProps) {
  const formValue = selectionMode === "directory" ? selectedPath ?? currentPath ?? value ?? "" : selectedPath ?? value ?? "";

  function selectNode(node: FileTreeNode) {
    onSelectionChange?.({
      name: node.name,
      path: node.path,
      type: node.type,
    });
  }

  function renderNodes(nodes: FileTreeNode[], depth = 0): ReactNode {
    return nodes.map((node) => {
      const prefix = renderPrefix?.(node);
      const selected = selectedPath === node.path;
      const rowClasses = [
        "flex min-h-11 w-full items-center gap-2 px-3 py-1 text-left text-lg leading-7 disabled:opacity-25",
        node.type === "directory" ? "font-bold" : "",
        selected ? "underline underline-offset-4" : "",
      ]
        .filter(Boolean)
        .join(" ");

      if (node.type === "directory") {
        const expanded = isExpanded(node.path, expandedPaths);
        const error = directoryErrors[node.path] ?? null;
        const loading = expanded && node.children === null && !error;
        const isSelectable = selectionMode === "directory";

        return (
          <li key={node.path}>
            <div className="flex min-h-11 items-center" style={{ paddingLeft: `${depth * 1.5}rem` }}>
              <button
                aria-label={`${expanded ? "Collapse" : "Expand"} ${node.name}/`}
                className="inline-flex min-h-11 min-w-11 items-center justify-center"
                onClick={() => onToggleDirectory?.(node.path)}
                type="button"
              >
                <Icon aria-hidden="true" className="size-5" icon={expanded ? "mdi:chevron-down" : "mdi:chevron-right"} />
              </button>
              <button
                aria-expanded={expanded}
                className={rowClasses}
                onClick={() => {
                  if (isSelectable) {
                    selectNode(node);
                    return;
                  }

                  onToggleDirectory?.(node.path);
                }}
                type="button"
              >
                {prefix ? <span className="w-5 shrink-0">{prefix}</span> : null}
                <span className="truncate">{node.name}/</span>
                {loading ? <span className="text-sm opacity-60">Loading...</span> : null}
              </button>
            </div>
            {expanded && node.children?.length ? <ul>{renderNodes(node.children, depth + 1)}</ul> : null}
            {expanded && error ? (
              <div className="flex min-h-11 items-center gap-3 px-3 py-2 text-lg leading-7 opacity-80" style={{ paddingLeft: `${(depth + 2) * 1.5}rem` }}>
                <span className="min-w-0 flex-1">{error}</span>
                {onRetryDirectory ? (
                  <button className="underline underline-offset-4" onClick={() => onRetryDirectory(node.path)} type="button">
                    Retry
                  </button>
                ) : null}
              </div>
            ) : null}
            {expanded && node.children && node.children.length === 0 ? (
              <div className="min-h-11 px-3 py-2 text-lg leading-7 italic opacity-60" style={{ paddingLeft: `${(depth + 1) * 1.5 + 3.75}rem` }}>
                (empty)
              </div>
            ) : null}
          </li>
        );
      }

      if (selectionMode === "directory") {
        return null;
      }

      return (
        <li key={node.path}>
          <button
            className={rowClasses}
            onClick={() => selectNode(node)}
            style={{ paddingLeft: `${depth * 1.5 + 3.75}rem` }}
            type="button"
          >
            {prefix ? <span className="w-5 shrink-0">{prefix}</span> : null}
            <span className="truncate">{node.name}</span>
          </button>
        </li>
      );
    });
  }

  return (
    <section className="space-y-3">
      {label ? <p className="text-sm uppercase tracking-[0.08em]">{label}</p> : null}
      {name ? <input name={name} type="hidden" value={formValue} /> : null}
      <div role="tree">
        {tree.length ? <ul>{renderNodes(tree)}</ul> : <p className="min-h-11 px-3 py-2 text-base">{emptyLabel}</p>}
      </div>
    </section>
  );
}
