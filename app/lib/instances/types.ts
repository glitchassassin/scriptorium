export type InstanceStatus = "starting" | "running" | "stopped" | "error";

export type InstanceRecord = {
  id: string;
  name: string;
  directory: string;
  port: number;
  status: InstanceStatus;
  createdAt: string;
  updatedAt: string;
  lastStartedAt: string | null;
  lastExitAt: string | null;
  lastError: string | null;
};

export type FileBrowserSelectionMode = "directory" | "file" | "either";

export type FileBrowserEntry = {
  name: string;
  path: string;
  type: "file" | "directory";
};

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
  title: string | null;
  directory: string | null;
  createdAt: number | null;
  updatedAt: number | null;
};
