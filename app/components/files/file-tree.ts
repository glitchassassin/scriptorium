import type {
  FileBrowserEntry,
  FileTreeDirectoryNode,
  FileTreeNode,
  FileTreeStatus,
  GitChangedFile,
} from "~/lib/instances/types";

function compareNodes(left: FileTreeNode, right: FileTreeNode) {
  if (left.type !== right.type) {
    return left.type === "directory" ? -1 : 1;
  }

  return left.name.localeCompare(right.name);
}

function toStatus(file: GitChangedFile): FileTreeStatus {
  if (file.changeType === "added" || file.changeType === "untracked") {
    return "A";
  }

  if (file.changeType === "deleted") {
    return "D";
  }

  return "M";
}

export function entriesToFileTreeNodes(entries: FileBrowserEntry[]): FileTreeNode[] {
  return entries.map((entry) =>
    entry.type === "directory"
      ? {
          children: null,
          name: entry.name,
          path: entry.path,
          type: "directory",
        }
      : {
          name: entry.name,
          path: entry.path,
          type: "file",
        },
  );
}

export function replaceDirectoryChildren(
  nodes: FileTreeNode[],
  directoryPath: string,
  children: FileTreeNode[],
): FileTreeNode[] {
  return nodes.map((node) => {
    if (node.type === "directory" && node.path === directoryPath) {
      return {
        ...node,
        children,
      } satisfies FileTreeDirectoryNode;
    }

    if (node.type === "directory" && node.children) {
      return {
        ...node,
        children: replaceDirectoryChildren(node.children, directoryPath, children),
      } satisfies FileTreeDirectoryNode;
    }

    return node;
  });
}

export function findNode(nodes: FileTreeNode[], path: string): FileTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) {
      return node;
    }

    if (node.type === "directory" && node.children) {
      const match = findNode(node.children, path);

      if (match) {
        return match;
      }
    }
  }

  return null;
}

export function getAncestorDirectoryPaths(path: string): string[] {
  const segments = path.split("/").filter(Boolean);
  const ancestors: string[] = [];

  for (let index = 1; index < segments.length; index += 1) {
    ancestors.push(`/${segments.slice(0, index).join("/")}`);
  }

  return ancestors;
}

export function collectDirectoryPaths(nodes: FileTreeNode[]): string[] {
  const paths: string[] = [];

  for (const node of nodes) {
    if (node.type === "directory") {
      paths.push(node.path);

      if (node.children) {
        paths.push(...collectDirectoryPaths(node.children));
      }
    }
  }

  return paths;
}

export function collectFilePaths(nodes: FileTreeNode[]): string[] {
  const paths: string[] = [];

  for (const node of nodes) {
    if (node.type === "file") {
      paths.push(node.path);
      continue;
    }

    if (node.children) {
      paths.push(...collectFilePaths(node.children));
    }
  }

  return paths;
}

export function buildChangedFilesTree(files: GitChangedFile[]): FileTreeNode[] {
  const root: FileTreeDirectoryNode = {
    children: [],
    name: ".",
    path: "",
    type: "directory",
  };

  for (const file of files) {
    const segments = file.path.split("/").filter(Boolean);

    if (!segments.length) {
      continue;
    }

    let current = root;

    for (const [index, segment] of segments.entries()) {
      const isLeaf = index === segments.length - 1;
      const nextPath = current.path ? `${current.path}/${segment}` : segment;

      if (isLeaf) {
        current.children ??= [];
        current.children.push({
          name: segment,
          path: nextPath,
          status: toStatus(file),
          type: "file",
        });
        continue;
      }

      current.children ??= [];

      const existing = current.children.find(
        (child): child is FileTreeDirectoryNode => child.type === "directory" && child.path === nextPath,
      );

      if (existing) {
        current = existing;
        continue;
      }

      const directory: FileTreeDirectoryNode = {
        children: [],
        name: segment,
        path: nextPath,
        type: "directory",
      };

      current.children.push(directory);
      current = directory;
    }
  }

  function sortNodes(nodes: FileTreeNode[]): FileTreeNode[] {
    return [...nodes].sort(compareNodes).map((node) => {
      if (node.type !== "directory" || !node.children) {
        return node;
      }

      return {
        ...node,
        children: sortNodes(node.children),
      } satisfies FileTreeDirectoryNode;
    });
  }

  return sortNodes(root.children ?? []);
}
