import type { RefObject } from "react";

import type { ModelMetadata } from "~/lib/opencode/models";
import type { OpencodeCommandInfo, OpencodeModelRef } from "~/lib/opencode/events";
import type { DraftImage } from "./session-composer-draft";

export type ComposerTray = "commands" | "model" | null;
export type VisibleTray = "commands-description" | "commands-list" | "images" | "model" | null;

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

export type SessionComposerController = {
  abortError: string | null;
  collapsedProviderIDs: Set<string>;
  commandDescription: string | null;
  commandError: string | null;
  commands: OpencodeCommandInfo[];
  composerInputRef: RefObject<HTMLTextAreaElement | null>;
  composerText: string;
  currentVariant: string | null;
  imageInputRef: RefObject<HTMLInputElement | null>;
  images: DraftImage[];
  isAbortPending: boolean;
  isCommandPending: boolean;
  isPromptPending: boolean;
  isRestoringAttachments: boolean;
  modelGroups: SessionComposerModelGroup[];
  modelSearch: string;
  promptError: string | null;
  selectedAgent: string | null;
  selectedModel: OpencodeModelRef | null;
  variantOptions: string[];
  visibleTray: VisibleTray;
  onAbort: () => void;
  onAddImages: (items: FileList | File[]) => Promise<void>;
  onCommand: (commandName: string) => void;
  onCommandsToggle: () => void;
  onComposerTextChange: (value: string) => void;
  onCycleAgent: () => void;
  onModelSearchChange: (value: string) => void;
  onModelSelect: (model: OpencodeModelRef) => void;
  onModelToggle: () => void;
  onProviderToggle: (providerID: string) => void;
  onRemoveImage: (id: string) => Promise<void>;
  onSubmit: () => void;
  onUpdateSelection: (target?: HTMLTextAreaElement | null) => void;
  onVariantCycle: () => void;
};
