import type { FileTreeStatus, GitStatusSummary } from "~/lib/projects/types";

export const sessionReviewModes = ["session", "recent", "uncommitted"] as const;

export type SessionReviewMode = (typeof sessionReviewModes)[number];
export type ReviewMode = SessionReviewMode;

export type ReviewModeOption = {
  mode: SessionReviewMode;
  label: string;
};

export type ReviewFile = {
  path: string;
  oldPath: string | null;
  status: FileTreeStatus | null;
};

type ReviewFileBase = {
  binary: boolean;
  oldPath: string | null;
  path: string;
};

export type ReviewFileContent = ReviewFileBase & {
  mode: "content";
  content: string;
};

export type ReviewFileDiff = ReviewFileBase & {
  mode: "diff";
  content: string;
  diffContent: string;
  diffSide: "old" | "new";
};

export type ReviewFileSelection = ReviewFileContent | ReviewFileDiff;

export type ReviewData = {
  emptyLabel: string;
  files: ReviewFile[];
  git: GitStatusSummary | null;
};

export function getReviewModeLabel(mode: ReviewMode) {
  switch (mode) {
    case "session":
      return "Session Changes";
    case "recent":
      return "Recent Changes";
    default:
      return "Uncommitted Changes";
  }
}

export function getSessionReviewModeOptions(): ReviewModeOption[] {
  return sessionReviewModes.map((mode) => ({
    label: getReviewModeLabel(mode),
    mode,
  }));
}
