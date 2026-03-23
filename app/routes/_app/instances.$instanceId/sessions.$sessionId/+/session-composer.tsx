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
  composerInputRef,
  composerText,
  imageInputRef,
  images,
  isAbortPending,
  isBusy,
  isPromptPending,
  isRestoringAttachments,
  onAbort,
  onAddImages,
  onComposerTextChange,
  onCycleAgent,
  onRemoveImage,
  onSubmit,
  onUpdateSelection,
  promptError,
  selectedAgent,
  sessionError,
}: {
  abortError: string | null;
  agents: string[];
  composerInputRef: RefObject<HTMLTextAreaElement | null>;
  composerText: string;
  imageInputRef: RefObject<HTMLInputElement | null>;
  images: DraftImage[];
  isAbortPending: boolean;
  isBusy: boolean;
  isPromptPending: boolean;
  isRestoringAttachments: boolean;
  onAbort: () => void;
  onAddImages: (items: FileList | File[]) => Promise<void>;
  onComposerTextChange: (value: string) => void;
  onCycleAgent: () => void;
  onRemoveImage: (id: string) => Promise<void>;
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
    const data = promptFetcher.data as { intent?: string; ok?: boolean } | undefined;

    if (!data) {
      lastHandledPromptDataRef.current = null;
      return;
    }

    if (lastHandledPromptDataRef.current === data) {
      return;
    }

    if (data?.ok && data.intent === "prompt") {
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

  const submitAbort = useCallback(() => {
    const formData = new FormData();
    formData.set("intent", "abort");
    abortFetcher.submit(formData, { method: "post" });
  }, [abortFetcher]);

  const promptData = promptFetcher.data as { error?: string | null; intent?: string } | undefined;
  const abortData = abortFetcher.data as { error?: string | null; intent?: string } | undefined;
  const promptError = promptData?.intent === "prompt" ? promptData.error ?? null : null;
  const abortError = abortData?.intent === "abort" ? abortData.error ?? null : null;
  const isPromptPending = promptFetcher.state !== "idle";
  const isAbortPending = abortFetcher.state !== "idle";

  return (
    <SessionComposerView
      abortError={abortError}
      agents={agents}
      composerInputRef={composerInputRef}
      composerText={composerText}
      imageInputRef={imageInputRef}
      images={images}
      isAbortPending={isAbortPending}
      isBusy={isBusy}
      isPromptPending={isPromptPending}
      isRestoringAttachments={isRestoringAttachments}
      onAbort={submitAbort}
      onAddImages={addImages}
      onComposerTextChange={setComposerText}
      onCycleAgent={cycleAgent}
      onRemoveImage={removeImage}
      onSubmit={submitPrompt}
      onUpdateSelection={updateComposerSelection}
      promptError={promptError}
      selectedAgent={selectedAgent}
      sessionError={sessionError}
    />
  );
}
