import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFetcher } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import { ComposerHorizontalTray, ComposerPanelTray, ComposerTrayFrame } from "~/components/ui/composer-trays";
import { cn } from "~/lib/cn";
import { parseSlashCommand } from "~/lib/opencode/commands";
import type { OpencodeCommandInfo, OpencodeModelRef, OpencodeProvider } from "~/lib/opencode/events";
import { getModelLabel, getModelMetadata, getModelVariants, type ModelCapabilities } from "~/lib/opencode/models";
import safeArea from "~/styles/safe-area.module.css";
import { useSessionComposerDraft, type DraftImage } from "./session-composer-draft";

type SessionComposerProps = {
  agents: string[];
  commands: OpencodeCommandInfo[];
  defaultAgent: string | null;
  defaultModel: OpencodeModelRef | null;
  defaultVariant: string | null;
  insertReferenceEvents: EventTarget;
  isBusy: boolean;
  onClearSessionError: () => void;
  providers: OpencodeProvider[];
  prefilledPrompt: string;
  sessionError: string | null;
  sessionId: string;
};

function isImage(file: File) {
  return file.type.startsWith("image/");
}

type ComposerTray = "commands" | "model" | null;
type VisibleTray = "commands-description" | "commands-list" | "images" | "model" | null;

function trayToggleButtonClass(isActive: boolean) {
  return cn(
    "min-h-11 px-3 py-2 text-left text-sm leading-5 disabled:opacity-25",
    isActive ? "bg-black text-white" : "bg-white text-black",
  );
}

function activeCommandsButtonClass(visibleTray: VisibleTray) {
  return visibleTray === "commands-description" || visibleTray === "commands-list"
    ? "bg-black text-white"
    : "bg-white text-black";
}

function ModelCapabilityIcons({ capabilities, isSelected }: { capabilities: ModelCapabilities; isSelected: boolean }) {
  const iconClassName = cn("size-4", isSelected ? "text-white" : "text-black");
  const placeholderClassName = cn("inline-block size-4", isSelected ? "text-white/25" : "text-black/25");

  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {capabilities.reasoning ? <Icon className={iconClassName} icon="mdi:brain" /> : <span className={placeholderClassName} />}
      {capabilities.tools ? <Icon className={iconClassName} icon="mdi:wrench" /> : <span className={placeholderClassName} />}
      {capabilities.files ? <Icon className={iconClassName} icon="mdi:paperclip" /> : <span className={placeholderClassName} />}
    </span>
  );
}

function SessionComposerView({
  abortError,
  agents,
  commands,
  commandDescription,
  commandError,
  composerInputRef,
  composerText,
  currentVariant,
  imageInputRef,
  images,
  isAbortPending,
  isBusy,
  isCommandPending,
  isPromptPending,
  isRestoringAttachments,
  modelSearch,
  modelGroups,
  providers,
  collapsedProviderIDs,
  selectedModel,
  visibleTray,
  onAbort,
  onAddImages,
  onComposerTextChange,
  onCommandsToggle,
  onCycleAgent,
  onModelSearchChange,
  onModelSelect,
  onProviderToggle,
  onModelToggle,
  onRemoveImage,
  onCommand,
  onSubmit,
  onUpdateSelection,
  onVariantCycle,
  promptError,
  selectedAgent,
  sessionError,
  variantOptions,
}: {
  abortError: string | null;
  agents: string[];
  commands: OpencodeCommandInfo[];
  commandDescription: string | null;
  commandError: string | null;
  composerInputRef: RefObject<HTMLTextAreaElement | null>;
  composerText: string;
  currentVariant: string | null;
  imageInputRef: RefObject<HTMLInputElement | null>;
  images: DraftImage[];
  isAbortPending: boolean;
  isBusy: boolean;
  isCommandPending: boolean;
  isPromptPending: boolean;
  isRestoringAttachments: boolean;
  modelSearch: string;
  modelGroups: Array<{
    providerID: string;
    providerLabel: string;
    models: Array<{
      key: string;
      metadata: {
        capabilities: ModelCapabilities;
        context: string | null;
        cost: string | null;
        status: string | null;
        variants: string | null;
      };
      model: OpencodeModelRef;
      modelLabel: string;
    }>;
  }>;
  collapsedProviderIDs: Set<string>;
  providers: OpencodeProvider[];
  selectedModel: OpencodeModelRef | null;
  visibleTray: VisibleTray;
  onAbort: () => void;
  onAddImages: (items: FileList | File[]) => Promise<void>;
  onComposerTextChange: (value: string) => void;
  onCommandsToggle: () => void;
  onCycleAgent: () => void;
  onModelSearchChange: (value: string) => void;
  onModelSelect: (model: OpencodeModelRef) => void;
  onProviderToggle: (providerID: string) => void;
  onModelToggle: () => void;
  onRemoveImage: (id: string) => Promise<void>;
  onCommand: (commandName: string) => void;
  onSubmit: () => void;
  onUpdateSelection: (target?: HTMLTextAreaElement | null) => void;
  onVariantCycle: () => void;
  promptError: string | null;
  selectedAgent: string | null;
  sessionError: string | null;
  variantOptions: string[];
}) {
  const effectiveCollapsedProviderIDs = modelSearch.trim() ? new Set<string>() : collapsedProviderIDs;

  return (
    <div className={`${safeArea.footerPad4} relative border-t-2 border-black px-6 pt-4 sm:px-8`}>
      <div className="space-y-3">
        {promptError ? <p className="text-base leading-6">{promptError}</p> : null}
        {commandError ? <p className="text-base leading-6">{commandError}</p> : null}
        {abortError ? <p className="text-base leading-6">{abortError}</p> : null}
        {sessionError ? <p className="text-base leading-6">{sessionError}</p> : null}
        {isRestoringAttachments ? <p className="text-sm leading-6">Restoring attachments...</p> : null}
      </div>
      {visibleTray === "images" && images.length ? (
        <ComposerTrayFrame>
          <ComposerHorizontalTray>
            {images.map((image) => (
              <div aria-label={image.file.name} className="relative size-20 overflow-hidden border-2 border-black bg-white" key={image.id}>
                <img alt={image.file.name} className="size-full object-cover" src={image.preview} />
                <button
                  aria-label={`Remove ${image.file.name}`}
                  className="absolute right-1 top-1 inline-flex size-6 items-center justify-center border-2 border-black bg-white"
                  onClick={() => void onRemoveImage(image.id)}
                  type="button"
                >
                  <Icon className="size-4" icon="mdi:close" />
                </button>
              </div>
            ))}
          </ComposerHorizontalTray>
        </ComposerTrayFrame>
      ) : null}
      {visibleTray === "commands-list" ? (
        <ComposerTrayFrame>
          <ComposerHorizontalTray>
            {commands.map((command) => (
              <button
                aria-label={`Insert /${command.name}`}
                className="min-h-11 shrink-0 bg-white px-3 py-2 text-base disabled:opacity-25"
                disabled={isBusy || isCommandPending}
                key={command.name}
                onClick={() => onCommand(command.name)}
                type="button"
              >
                /{command.name}
              </button>
            ))}
          </ComposerHorizontalTray>
        </ComposerTrayFrame>
      ) : null}
      {visibleTray === "commands-description" && commandDescription ? (
        <ComposerTrayFrame>
          <ComposerPanelTray title="Command">
            <p className="text-base leading-6">{commandDescription}</p>
          </ComposerPanelTray>
        </ComposerTrayFrame>
      ) : null}
      {visibleTray === "model" ? (
        <ComposerTrayFrame>
          <ComposerPanelTray title="Model">
            <input
              aria-label="Search models"
              className="min-h-11 w-full bg-white px-3 py-2 text-base"
              placeholder="Search models"
              onChange={(event) => onModelSearchChange(event.currentTarget.value)}
              type="text"
              value={modelSearch}
            />
            <div className="space-y-4">
              {modelGroups.length ? modelGroups.map((group) => (
                <section className="space-y-2" key={group.providerID}>
                  <button
                    aria-label={`Toggle ${group.providerLabel} models`}
                    className="flex min-h-11 w-full items-center gap-2 text-left text-sm font-bold uppercase tracking-[0.08em]"
                    onClick={() => onProviderToggle(group.providerID)}
                    type="button"
                  >
                    <Icon
                      className={cn(
                        "size-4 transition-transform",
                        effectiveCollapsedProviderIDs.has(group.providerID) ? "-rotate-90" : "rotate-0",
                      )}
                      icon="mdi:chevron-down"
                    />
                    <span>{group.providerLabel}</span>
                  </button>
                  <div hidden={effectiveCollapsedProviderIDs.has(group.providerID)}>
                    {group.models.map((entry, index) => {
                      const isSelected = selectedModel?.providerID === entry.model.providerID && selectedModel?.modelID === entry.model.modelID;

                      return (
                        <button
                          aria-label={`Use ${group.providerLabel} ${entry.modelLabel}`}
                          className={cn(
                            "flex min-h-14 w-full items-start justify-between gap-3 px-1 py-3 text-left text-base",
                            index > 0 ? "border-t border-black" : "",
                            isSelected ? "bg-black text-white" : "bg-white text-black",
                          )}
                          key={entry.key}
                          onClick={() => onModelSelect(entry.model)}
                          type="button"
                        >
                          <span className="min-w-0 space-y-1">
                            <span className="block">{entry.modelLabel}</span>
                            <span className={cn("flex items-center gap-3 text-sm", isSelected ? "text-white/80" : "text-black/70")}>
                              <ModelCapabilityIcons capabilities={entry.metadata.capabilities} isSelected={isSelected} />
                              <span>
                                {[entry.metadata.context, entry.metadata.cost].filter(Boolean).join(" ")}
                              </span>
                              {entry.metadata.status || entry.metadata.variants ? (
                                <span>{[entry.metadata.status, entry.metadata.variants].filter(Boolean).join(" · ")}</span>
                              ) : null}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )) : <p className="text-base leading-6">No models match that search.</p>}
            </div>
          </ComposerPanelTray>
        </ComposerTrayFrame>
      ) : null}
      <div className="mt-3">
        <form className="min-w-0" onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}>
          <div className="space-y-2">
            <div className="relative min-w-0">
              <input
                accept="image/*"
                className="hidden"
                multiple
                onChange={(event) => {
                  if (event.currentTarget.files) {
                    void onAddImages(event.currentTarget.files);
                  }

                  event.currentTarget.value = "";
                }}
                ref={imageInputRef}
                type="file"
              />
              <textarea
                className="min-h-32 w-full px-3 py-2 pr-14 text-base leading-7"
                name="text"
                onBlur={(event) => onUpdateSelection(event.currentTarget)}
                onChange={(event) => {
                  onComposerTextChange(event.currentTarget.value);
                  onUpdateSelection(event.currentTarget);
                }}
                onClick={(event) => onUpdateSelection(event.currentTarget)}
                onDragOver={(event) => {
                  if (Array.from(event.dataTransfer?.files ?? []).some(isImage)) {
                    event.preventDefault();
                  }
                }}
                onDrop={(event) => {
                  const files = Array.from(event.dataTransfer.files ?? []).filter(isImage);

                  if (files.length === 0) {
                    return;
                  }

                  event.preventDefault();
                  void onAddImages(files);
                }}
                onKeyUp={(event) => onUpdateSelection(event.currentTarget)}
                onPaste={(event) => {
                  const files = Array.from(event.clipboardData.files ?? []).filter(isImage);

                  if (files.length === 0) {
                    return;
                  }

                  event.preventDefault();
                  void onAddImages(files);
                }}
                onSelect={(event) => onUpdateSelection(event.currentTarget)}
                placeholder="Send a message, paste an image, or attach one"
                ref={composerInputRef}
                value={composerText}
              />
              <button
                aria-label="Attach image"
                className="absolute bottom-3 right-3 inline-flex min-h-11 min-w-11 items-center justify-center bg-white disabled:opacity-25"
                disabled={isPromptPending}
                onClick={() => imageInputRef.current?.click()}
                type="button"
              >
                <Icon className="size-6" icon="mdi:image-plus" />
              </button>
            </div>
            <div className="flex items-stretch justify-between gap-2 pb-1">
              <div className="flex min-w-0 items-stretch gap-2 overflow-x-auto">
                <button
                  aria-label="Cycle agent"
                  className={trayToggleButtonClass(false)}
                  disabled={!agents.length}
                  onClick={onCycleAgent}
                  onPointerDown={(event) => event.preventDefault()}
                  type="button"
                >
                  {selectedAgent ?? "No agent"}
                </button>
                <button
                  aria-label="Toggle model tray"
                  className={trayToggleButtonClass(visibleTray === "model")}
                  onClick={onModelToggle}
                  onPointerDown={(event) => event.preventDefault()}
                  type="button"
                >
                  {getModelLabel(selectedModel, providers)}
                </button>
                <button
                  aria-label="Cycle variant"
                  className={trayToggleButtonClass(false)}
                  disabled={variantOptions.length === 0}
                  onClick={onVariantCycle}
                  onPointerDown={(event) => event.preventDefault()}
                  type="button"
                >
                  {currentVariant ?? "Auto"}
                </button>
              </div>
              <div className="ml-auto flex shrink-0 items-stretch gap-2">
                <button
                  aria-label="Toggle commands tray"
                  className={cn(
                    "inline-flex min-h-11 min-w-11 items-center justify-center disabled:opacity-25",
                    activeCommandsButtonClass(visibleTray),
                  )}
                  disabled={false}
                  onClick={onCommandsToggle}
                  onPointerDown={(event) => event.preventDefault()}
                  type="button"
                >
                  <Icon className="size-6" icon="mdi:robot-excited" />
                </button>
                <button
                  aria-label="Stop current response"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center disabled:opacity-25"
                  disabled={isAbortPending || !isBusy}
                  onClick={onAbort}
                  onPointerDown={(event) => event.preventDefault()}
                  type="button"
                >
                  <Icon className="size-6" icon="mdi:stop-circle" />
                </button>
                <button
                  aria-label="Send message"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center bg-black text-white disabled:opacity-25"
                  disabled={isPromptPending}
                  onClick={onSubmit}
                  onPointerDown={(event) => event.preventDefault()}
                  type="button"
                >
                  <Icon className="size-6" icon="mdi:send" />
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export function SessionComposer({
  agents,
  commands,
  defaultAgent,
  defaultModel,
  defaultVariant,
  insertReferenceEvents,
  isBusy,
  onClearSessionError,
  providers,
  prefilledPrompt,
  sessionError,
  sessionId,
}: SessionComposerProps) {
  const promptFetcher = useFetcher();
  const commandFetcher = useFetcher();
  const abortFetcher = useFetcher();
  const lastHandledPromptDataRef = useRef<unknown>(null);
  const [activeTray, setActiveTray] = useState<ComposerTray>(null);
  const [modelSearch, setModelSearch] = useState("");
  const [collapsedProviderIDs, setCollapsedProviderIDs] = useState<Set<string>>(() => new Set());
  const {
    addImages,
    clearDraftContent,
    composerInputRef,
    composerText,
    imageInputRef,
    images,
    insertComposerReference,
    isRestoringAttachments,
    removeImage,
    selectedAgent,
    selectedModel,
    selectedVariant,
    setComposerText,
    setSelectedAgent,
    setSelectedModel,
    setSelectedVariant,
    updateComposerSelection,
  } = useSessionComposerDraft({ defaultAgent, defaultModel, defaultVariant, prefilledPrompt, sessionId });

  useEffect(() => {
    function handleInsertReference(event: Event) {
      if (!(event instanceof CustomEvent) || typeof event.detail !== "string") {
        return;
      }

      insertComposerReference(event.detail);
    }

    insertReferenceEvents.addEventListener("insert-reference", handleInsertReference);

    return () => {
      insertReferenceEvents.removeEventListener("insert-reference", handleInsertReference);
    };
  }, [insertComposerReference, insertReferenceEvents]);

  useEffect(() => {
    const data = promptFetcher.data as { clearDraft?: boolean; intent?: string; ok?: boolean } | undefined;

    if (!data) {
      lastHandledPromptDataRef.current = null;
      return;
    }

    if (lastHandledPromptDataRef.current === data) {
      return;
    }

    if (data?.ok && data.clearDraft) {
      lastHandledPromptDataRef.current = data;
      onClearSessionError();
      void clearDraftContent();
    }
  }, [clearDraftContent, onClearSessionError, promptFetcher.data]);

  useEffect(() => {
    setActiveTray(null);
    setModelSearch("");
    setCollapsedProviderIDs(new Set());
  }, [sessionId]);

  const cycleAgent = useCallback(() => {
    setSelectedAgent((current) => {
      if (agents.length === 0) {
        return current;
      }

      const currentIndex = current ? agents.indexOf(current) : -1;

      if (currentIndex === -1) {
        return agents[0] ?? null;
      }

      return agents[(currentIndex + 1) % agents.length] ?? null;
    });
  }, [agents, setSelectedAgent]);

  const commandNames = useMemo(() => commands.map((command) => command.name), [commands]);
  const parsedSlashCommand = useMemo(() => parseSlashCommand(composerText, commandNames), [commandNames, composerText]);
  const variantOptions = useMemo(() => selectedModel ? getModelVariants(selectedModel, providers) : [], [providers, selectedModel]);
  const currentVariant = selectedVariant && variantOptions.includes(selectedVariant) ? selectedVariant : null;
  const modelGroups = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();

    return providers.map((provider) => ({
      providerID: provider.id,
      providerLabel: provider.name,
      models: Object.values(provider.models).map((info) => ({
        key: `${provider.id}/${info.id}`,
        metadata: getModelMetadata(info),
        model: { modelID: info.id, providerID: provider.id },
        modelLabel: info.name,
      })).filter((entry) => {
        if (!query) {
          return true;
        }

        return [
          entry.key,
          entry.modelLabel,
          provider.name,
          entry.metadata.context,
          entry.metadata.cost,
          entry.metadata.status,
          entry.metadata.variants,
          entry.metadata.capabilities.reasoning ? "reasoning" : "",
          entry.metadata.capabilities.tools ? "tools" : "",
          entry.metadata.capabilities.files ? "files" : "",
        ].some((value) => (value ?? "").toLowerCase().includes(query));
      }),
    })).filter((group) => group.models.length > 0);
  }, [modelSearch, providers]);

  const submitPrompt = useCallback(() => {
    const formData = new FormData();
    formData.set("agent", selectedAgent ?? "");
    formData.set("modelProviderID", selectedModel?.providerID ?? "");
    formData.set("modelID", selectedModel?.modelID ?? "");
    formData.set("variant", currentVariant ?? "");
    images.forEach((image) => formData.append("attachments", image.file, image.file.name));

    if (parsedSlashCommand) {
      onClearSessionError();
      void clearDraftContent();
      formData.set("intent", "command");
      formData.set("arguments", parsedSlashCommand.arguments);
      formData.set("clearDraft", "1");
      formData.set("command", parsedSlashCommand.command);
      commandFetcher.submit(formData, { encType: "multipart/form-data", method: "post" });
      return;
    }

    formData.set("intent", "prompt");
    formData.set("text", composerText);
    promptFetcher.submit(formData, { encType: "multipart/form-data", method: "post" });
  }, [clearDraftContent, commandFetcher, composerText, currentVariant, images, onClearSessionError, parsedSlashCommand, promptFetcher, selectedAgent, selectedModel]);

  const promptData = promptFetcher.data as { error?: string | null; intent?: string } | undefined;
  const commandData = commandFetcher.data as { error?: string | null; intent?: string } | undefined;
  const abortData = abortFetcher.data as { error?: string | null; intent?: string } | undefined;
  const commandError = commandData?.intent === "command" ? commandData.error ?? null : null;
  const promptError = promptData?.intent === "prompt" ? promptData.error ?? null : null;
  const abortError = abortData?.intent === "abort" ? abortData.error ?? null : null;
  const isPromptPending = promptFetcher.state !== "idle";
  const isCommandPending = commandFetcher.state !== "idle";
  const isAbortPending = abortFetcher.state !== "idle";

  const submitAbort = useCallback(() => {
    const formData = new FormData();
    formData.set("intent", "abort");
    abortFetcher.submit(formData, { method: "post" });
  }, [abortFetcher]);

  const toggleCommandsTray = useCallback(() => {
    setActiveTray((current) => current === "commands" ? null : "commands");
  }, []);

  const toggleModelTray = useCallback(() => {
    setActiveTray((current) => current === "model" ? null : "model");
  }, []);

  const toggleProvider = useCallback((providerID: string) => {
    setCollapsedProviderIDs((current) => {
      const next = new Set(current);

      if (next.has(providerID)) {
        next.delete(providerID);
      } else {
        next.add(providerID);
      }

      return next;
    });
  }, []);

  const cycleVariant = useCallback(() => {
    if (variantOptions.length === 0) {
      return;
    }

    if (!currentVariant) {
      setSelectedVariant(variantOptions[0] ?? null);
      return;
    }

    const index = variantOptions.indexOf(currentVariant);

    if (index === -1 || index === variantOptions.length - 1) {
      setSelectedVariant(null);
      return;
    }

    setSelectedVariant(variantOptions[index + 1] ?? null);
  }, [currentVariant, setSelectedVariant, variantOptions]);

  const matchedCommand = useMemo(() => {
    if (!parsedSlashCommand) {
      return null;
    }

    return commands.find((command) => command.name === parsedSlashCommand.command) ?? null;
  }, [commands, parsedSlashCommand]);

  const populateCommand = useCallback((commandName: string) => {
    const nextText = `/${commandName} `;
    setComposerText(nextText);

    window.requestAnimationFrame(() => {
      const input = composerInputRef.current;

      if (!input) {
        return;
      }

      input.focus();
      input.setSelectionRange(nextText.length, nextText.length);
      updateComposerSelection(input);
    });
  }, [composerInputRef, setComposerText, updateComposerSelection]);

  const insertCommandFromTray = useCallback((commandName: string) => {
    populateCommand(commandName);
  }, [populateCommand]);

  const selectModel = useCallback((model: OpencodeModelRef) => {
    setSelectedModel(model);
    setActiveTray(null);
    setModelSearch("");
  }, [setSelectedModel]);

  const visibleTray: VisibleTray = activeTray === "model"
    ? "model"
    : activeTray === "commands"
      ? matchedCommand?.description
        ? "commands-description"
        : "commands-list"
      : images.length
        ? "images"
        : null;

  return (
    <SessionComposerView
      abortError={abortError}
      agents={agents}
      commands={commands}
      commandDescription={matchedCommand?.description ?? null}
      commandError={commandError}
      composerInputRef={composerInputRef}
      composerText={composerText}
      currentVariant={currentVariant}
      imageInputRef={imageInputRef}
      images={images}
      isAbortPending={isAbortPending}
      isBusy={isBusy}
      isCommandPending={isCommandPending}
      isPromptPending={isPromptPending}
      isRestoringAttachments={isRestoringAttachments}
      collapsedProviderIDs={collapsedProviderIDs}
      modelSearch={modelSearch}
      modelGroups={modelGroups}
      providers={providers}
      selectedModel={selectedModel}
      variantOptions={variantOptions}
      visibleTray={visibleTray}
      onAbort={submitAbort}
      onAddImages={addImages}
      onComposerTextChange={setComposerText}
      onCommandsToggle={toggleCommandsTray}
      onCycleAgent={cycleAgent}
      onModelSearchChange={setModelSearch}
      onModelSelect={selectModel}
      onProviderToggle={toggleProvider}
      onModelToggle={toggleModelTray}
      onRemoveImage={removeImage}
      onCommand={insertCommandFromTray}
      onSubmit={submitPrompt}
      onUpdateSelection={updateComposerSelection}
      onVariantCycle={cycleVariant}
      promptError={promptError}
      selectedAgent={selectedAgent}
      sessionError={sessionError}
    />
  );
}
