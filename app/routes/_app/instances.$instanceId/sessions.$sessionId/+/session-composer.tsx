import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useFetcher } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import safeArea from "~/styles/safe-area.module.css";
import { useSessionComposerDraft, type DraftImage } from "./session-composer-draft";

type SessionComposerProps = {
  agents: string[];
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

function SessionComposerView({
  abortError,
  agents,
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
  onAbort,
  onAddImages,
  onComposerTextChange,
  onCycleAgent,
  onRemoveImage,
  onReview,
  onSubmit,
  onUpdateSelection,
  promptError,
  selectedAgent,
  sessionError,
}: {
  abortError: string | null;
  agents: string[];
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
  onAbort: () => void;
  onAddImages: (items: FileList | File[]) => Promise<void>;
  onComposerTextChange: (value: string) => void;
  onCycleAgent: () => void;
  onRemoveImage: (id: string) => Promise<void>;
  onReview: () => void;
  onSubmit: () => void;
  onUpdateSelection: (target?: HTMLTextAreaElement | null) => void;
  promptError: string | null;
  selectedAgent: string | null;
  sessionError: string | null;
}) {
  return (
    <div className={`${safeArea.footerPad4} border-t-2 border-black px-6 pt-4 sm:px-8`}>
      <div className="space-y-3">
        {promptError ? <p className="text-base leading-6">{promptError}</p> : null}
        {commandError ? <p className="text-base leading-6">{commandError}</p> : null}
        {abortError ? <p className="text-base leading-6">{abortError}</p> : null}
        {sessionError ? <p className="text-base leading-6">{sessionError}</p> : null}
        {isRestoringAttachments ? <p className="text-sm leading-6">Restoring attachments...</p> : null}
        <div className="flex items-stretch gap-2">
          <div className="min-w-0 flex-1">
            <form className="min-w-0 flex-1" onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}>
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
              {images.length ? (
                <div className="flex flex-wrap gap-2 border-b-2 border-black px-3 py-3">
                  {images.map((image) => (
                    <div key={image.id} className="relative size-20 overflow-hidden border-2 border-black bg-white">
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
                </div>
              ) : null}
              <textarea
                className="min-h-32 w-full px-3 py-2 text-base leading-7"
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
            </form>
          </div>
          <div className="flex shrink-0 self-stretch flex-col items-stretch justify-between gap-1">
            <div className="flex items-stretch gap-2">
              <button
                aria-label="Cycle agent"
                className="min-h-11 bg-white px-3 py-2 text-left text-sm leading-5 disabled:opacity-25"
                disabled={!agents.length}
                onClick={onCycleAgent}
                onPointerDown={(event) => event.preventDefault()}
                type="button"
              >
                {selectedAgent ?? "No agent"}
              </button>
              <button
                aria-label="Start review"
                className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center bg-white disabled:opacity-25"
                disabled={isBusy || isCommandPending}
                onClick={onReview}
                onPointerDown={(event) => event.preventDefault()}
                type="button"
              >
                <Icon className="size-6" icon="mdi:robot-excited" />
              </button>
            </div>
            <div className="flex items-end gap-2">
              <button
                aria-label="Attach image"
                className="inline-flex min-h-11 min-w-11 items-center justify-center bg-white disabled:opacity-25"
                disabled={isPromptPending}
                onClick={() => imageInputRef.current?.click()}
                type="button"
              >
                <Icon className="size-6" icon="mdi:image-plus" />
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
      </div>
    </div>
  );
}

export function SessionComposer({
  agents,
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

  const submitPrompt = useCallback(() => {
    const formData = new FormData();
    formData.set("intent", "prompt");
    formData.set("agent", selectedAgent ?? "");
    formData.set("text", composerText);
    images.forEach((image) => formData.append("attachments", image.file, image.file.name));
    promptFetcher.submit(formData, { encType: "multipart/form-data", method: "post" });
  }, [composerText, images, promptFetcher, selectedAgent]);

  const promptData = promptFetcher.data as { error?: string | null; intent?: string } | undefined;
  const commandData = commandFetcher.data as { error?: string | null; intent?: string } | undefined;
  const abortData = abortFetcher.data as { error?: string | null; intent?: string } | undefined;
  const commandError = commandData?.intent === "command" ? commandData.error ?? null : null;
  const promptError = promptData?.intent === "prompt" ? promptData.error ?? null : null;
  const abortError = abortData?.intent === "abort" ? abortData.error ?? null : null;
  const isPromptPending = promptFetcher.state !== "idle";
  const isCommandPending = commandFetcher.state !== "idle";
  const isAbortPending = abortFetcher.state !== "idle";

  const submitReview = useCallback(() => {
    if (isBusy || isCommandPending) {
      return;
    }

    const formData = new FormData();
    formData.set("intent", "command");
    formData.set("agent", selectedAgent ?? "");
    formData.set("arguments", "");
    formData.set("clearDraft", "0");
    formData.set("command", "review");
    commandFetcher.submit(formData, { method: "post" });
  }, [commandFetcher, isBusy, isCommandPending, selectedAgent]);

  const submitAbort = useCallback(() => {
    const formData = new FormData();
    formData.set("intent", "abort");
    abortFetcher.submit(formData, { method: "post" });
  }, [abortFetcher]);

  return (
    <SessionComposerView
      abortError={abortError}
      agents={agents}
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
      onAbort={submitAbort}
      onAddImages={addImages}
      onComposerTextChange={setComposerText}
      onCycleAgent={cycleAgent}
      onRemoveImage={removeImage}
      onReview={submitReview}
      onSubmit={submitPrompt}
      onUpdateSelection={updateComposerSelection}
      promptError={promptError}
      selectedAgent={selectedAgent}
      sessionError={sessionError}
    />
  );
}
