import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFetcher } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import { ComposerHorizontalTray, ComposerPanelTray, ComposerTrayFrame } from "~/components/ui/composer-trays";
import { cn } from "~/lib/cn";
import { parseSlashCommand } from "~/lib/opencode/commands";
import type { OpencodeCommandInfo } from "~/lib/opencode/events";
import safeArea from "~/styles/safe-area.module.css";
import { useSessionComposerDraft, type DraftImage } from "./session-composer-draft";

type SessionComposerProps = {
  agents: string[];
  commands: OpencodeCommandInfo[];
  defaultAgent: string | null;
  insertReferenceEvents: EventTarget;
  isBusy: boolean;
  onClearSessionError: () => void;
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

function SessionComposerView({
  abortError,
  agents,
  commands,
  commandDescription,
  commandError,
  composerInputRef,
  composerText,
  imageInputRef,
  images,
  isAbortPending,
  isBusy,
  isCommandPending,
  isPromptPending,
  isRestoringAttachments,
  visibleTray,
  onAbort,
  onAddImages,
  onComposerTextChange,
  onCommandsToggle,
  onCycleAgent,
  onModelToggle,
  onRemoveImage,
  onCommand,
  onSubmit,
  onUpdateSelection,
  promptError,
  selectedAgent,
  sessionError,
}: {
  abortError: string | null;
  agents: string[];
  commands: OpencodeCommandInfo[];
  commandDescription: string | null;
  commandError: string | null;
  composerInputRef: RefObject<HTMLTextAreaElement | null>;
  composerText: string;
  imageInputRef: RefObject<HTMLInputElement | null>;
  images: DraftImage[];
  isAbortPending: boolean;
  isBusy: boolean;
  isCommandPending: boolean;
  isPromptPending: boolean;
  isRestoringAttachments: boolean;
  visibleTray: VisibleTray;
  onAbort: () => void;
  onAddImages: (items: FileList | File[]) => Promise<void>;
  onComposerTextChange: (value: string) => void;
  onCommandsToggle: () => void;
  onCycleAgent: () => void;
  onModelToggle: () => void;
  onRemoveImage: (id: string) => Promise<void>;
  onCommand: (commandName: string) => void;
  onSubmit: () => void;
  onUpdateSelection: (target?: HTMLTextAreaElement | null) => void;
  promptError: string | null;
  selectedAgent: string | null;
  sessionError: string | null;
}) {
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
          <ComposerPanelTray title="Model picker">
            <input
              aria-label="Search models"
              className="min-h-11 w-full bg-white px-3 py-2 text-base"
              placeholder="Search models"
              readOnly
              type="text"
              value=""
            />
            <p className="text-base leading-6">Model choices will land here in a follow-up change.</p>
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
                  Model
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
  insertReferenceEvents,
  isBusy,
  onClearSessionError,
  prefilledPrompt,
  sessionError,
  sessionId,
}: SessionComposerProps) {
  const promptFetcher = useFetcher();
  const commandFetcher = useFetcher();
  const abortFetcher = useFetcher();
  const lastHandledPromptDataRef = useRef<unknown>(null);
  const [activeTray, setActiveTray] = useState<ComposerTray>(null);
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
    setComposerText,
    setSelectedAgent,
    updateComposerSelection,
  } = useSessionComposerDraft({ defaultAgent, prefilledPrompt, sessionId });

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

  const submitPrompt = useCallback(() => {
    const formData = new FormData();
    formData.set("agent", selectedAgent ?? "");
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
  }, [clearDraftContent, commandFetcher, composerText, images, onClearSessionError, parsedSlashCommand, promptFetcher, selectedAgent]);

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
      imageInputRef={imageInputRef}
      images={images}
      isAbortPending={isAbortPending}
      isBusy={isBusy}
      isCommandPending={isCommandPending}
      isPromptPending={isPromptPending}
      isRestoringAttachments={isRestoringAttachments}
      visibleTray={visibleTray}
      onAbort={submitAbort}
      onAddImages={addImages}
      onComposerTextChange={setComposerText}
      onCommandsToggle={toggleCommandsTray}
      onCycleAgent={cycleAgent}
      onModelToggle={toggleModelTray}
      onRemoveImage={removeImage}
      onCommand={insertCommandFromTray}
      onSubmit={submitPrompt}
      onUpdateSelection={updateComposerSelection}
      promptError={promptError}
      selectedAgent={selectedAgent}
      sessionError={sessionError}
    />
  );
}
