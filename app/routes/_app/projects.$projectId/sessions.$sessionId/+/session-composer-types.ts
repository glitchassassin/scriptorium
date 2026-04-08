import type { RefObject } from "react";

import type { ModelMetadata, SessionModelChoice } from "~/lib/opencode/models";
import type { OpencodeAgent, OpencodeCommandInfo, OpencodeModelRef } from "~/lib/opencode/events";
import type { DraftAttachment } from "./session-composer-draft";

export type ComposerTray = "commands" | "model" | "subagents" | null;
export type VisibleTray = "commands-description" | "commands-list" | "images" | "model" | "subagents-description" | "subagents-list" | null;

export type SessionComposerModelGroup = {
  providerID: string;
  providerLabel: string;
  models: Array<{
    key: string;
    metadata: ModelMetadata;
    model: OpencodeModelRef;
    modelLabel: string;
  }>;
};

export type SessionComposerRecentModel = SessionModelChoice & {
  key: string;
  metadata: ModelMetadata;
  modelLabel: string;
  providerLabel: string;
};

export type SessionComposerController = {
  abortError: string | null;
  collapsedProviderIDs: Set<string>;
  commandDescription: string | null;
  commandError: string | null;
  commands: OpencodeCommandInfo[];
  attachmentInputRef: RefObject<HTMLInputElement | null>;
  attachments: DraftAttachment[];
  composerInputRef: RefObject<HTMLTextAreaElement | null>;
  composerText: string;
  currentVariant: string | null;
  isAbortPending: boolean;
  isCommandPending: boolean;
  isPromptPending: boolean;
  isRestoringAttachments: boolean;
  modelGroups: SessionComposerModelGroup[];
  modelSearch: string;
  promptError: string | null;
  recentModels: SessionComposerRecentModel[];
  selectedAgent: string | null;
  selectedModel: OpencodeModelRef | null;
  subagentDescription: string | null;
  subagents: OpencodeAgent[];
  variantOptions: string[];
  visibleTray: VisibleTray;
  onAddAttachments: (items: FileList | File[]) => Promise<void>;
  onAbort: () => void;
  onCommand: (commandName: string) => void;
  onCommandsToggle: () => void;
  onComposerTextChange: (value: string) => void;
  onCycleAgent: () => void;
  onModelSearchChange: (value: string) => void;
  onModelSelect: (model: OpencodeModelRef, variant?: string | null) => void;
  onModelToggle: () => void;
  onProviderToggle: (providerID: string) => void;
  onRemoveAttachment: (id: string) => Promise<void>;
  onSubagent: (subagentName: string) => void;
  onSubagentsToggle: () => void;
  onSubmit: () => void;
  onUpdateSelection: (target?: HTMLTextAreaElement | null) => void;
  onVariantCycle: () => void;
};
