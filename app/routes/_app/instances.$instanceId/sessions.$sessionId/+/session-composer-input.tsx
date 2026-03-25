import { Icon } from "@iconify/react";
import type { RefObject } from "react";

type SessionComposerInputProps = {
  composerInputRef: RefObject<HTMLTextAreaElement | null>;
  composerText: string;
  imageInputRef: RefObject<HTMLInputElement | null>;
  isPromptPending: boolean;
  onAddImages: (items: FileList | File[]) => Promise<void>;
  onComposerTextChange: (value: string) => void;
  onUpdateSelection: (target?: HTMLTextAreaElement | null) => void;
};

function getImageFiles(items: FileList | File[]) {
  return Array.from(items).filter((file) => file.type.startsWith("image/"));
}

export function SessionComposerInput({
  composerInputRef,
  composerText,
  imageInputRef,
  isPromptPending,
  onAddImages,
  onComposerTextChange,
  onUpdateSelection,
}: SessionComposerInputProps) {
  return (
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
          if (Array.from(event.dataTransfer?.files ?? []).some((file) => file.type.startsWith("image/"))) {
            event.preventDefault();
          }
        }}
        onDrop={(event) => {
          const files = getImageFiles(event.dataTransfer.files ?? []);

          if (files.length === 0) {
            return;
          }

          event.preventDefault();
          void onAddImages(files);
        }}
        onKeyUp={(event) => onUpdateSelection(event.currentTarget)}
        onPaste={(event) => {
          const files = getImageFiles(event.clipboardData.files ?? []);

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
  );
}
