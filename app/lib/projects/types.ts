export type ProjectRecord = {
  id: string;
  name: string;
  directory: string;
  createdAt: string;
  updatedAt: string;
};

export type FileBrowserSelectionMode = "directory" | "file" | "either";

export type FileBrowserEntry = {
  name: string;
  path: string;
  type: "file" | "directory";
};

export type FileTreeStatus = "A" | "M" | "D";

type FileTreeNodeBase = {
  name: string;
  path: string;
  status?: FileTreeStatus | null;
};

export type FileTreeFileNode = FileTreeNodeBase & {
  type: "file";
};

export type FileTreeDirectoryNode = FileTreeNodeBase & {
  type: "directory";
  children: FileTreeNode[] | null;
};

export type FileTreeNode = FileTreeFileNode | FileTreeDirectoryNode;

export type FileBrowserListing = {
  rootPath: string;
  currentPath: string;
  parentPath: string | null;
  entries: FileBrowserEntry[];
  selectionMode: FileBrowserSelectionMode;
};

export type FileBrowserSelection = {
  path: string;
  type: "file" | "directory";
  name: string;
};

export type FileBrowserContent = {
  path: string;
  name: string;
  content: string;
  binary: boolean;
};

export type FileBrowserLineRange = {
  start: number;
  end: number;
};

export type GitFileStatusCode = " " | "M" | "A" | "D" | "R" | "C" | "T" | "U" | "?" | "!";

export type GitChangeType =
  | "added"
  | "copied"
  | "deleted"
  | "modified"
  | "renamed"
  | "type-changed"
  | "unmerged"
  | "untracked";

export type GitChangedFile = {
  path: string;
  oldPath: string | null;
  indexStatus: GitFileStatusCode;
  workingTreeStatus: GitFileStatusCode;
  changeType: GitChangeType;
};

export type GitChangedFiles =
  | {
      isRepository: false;
    }
  | {
      isRepository: true;
      files: GitChangedFile[];
    };

type GitFileBase = {
  path: string;
  oldPath: string | null;
  binary: boolean;
};

export type GitFileContent = GitFileBase & {
  mode: "content";
  content: string;
};

export type GitFileDiff = GitFileBase & {
  mode: "diff";
  content: string;
  diffContent: string;
  diffSide: "old" | "new";
};

export type GitFileSelection = GitFileContent | GitFileDiff;

export type GitFileDiffResult =
  | {
      isRepository: false;
    }
  | ({
      isRepository: true;
    } & GitFileSelection);

export type GitStatusSummary =
  | {
      isRepository: false;
    }
  | {
      isRepository: true;
      branch: string | null;
      ahead: number;
      behind: number;
      staged: number;
      modified: number;
      untracked: number;
      clean: boolean;
    };

export type OpencodeSessionSummary = {
  id: string;
  parentID: string | null;
  title: string | null;
  directory: string | null;
  createdAt: number | null;
  updatedAt: number | null;
};

export type OpencodeSessionStatus =
  | {
      type: "idle";
    }
  | {
      type: "busy";
    }
  | {
      type: "retry";
      attempt: number;
      message: string;
      next: number;
    };
