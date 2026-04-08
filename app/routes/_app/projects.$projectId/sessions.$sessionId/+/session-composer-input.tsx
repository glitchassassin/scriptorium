import { Icon } from "@iconify/react";
import type { RefObject } from "react";

type SessionComposerInputProps = {
  attachmentInputRef: RefObject<HTMLInputElement | null>;
  composerInputRef: RefObject<HTMLTextAreaElement | null>;
  composerText: string;
  isPromptPending: boolean;
  onAddAttachments: (items: FileList | File[]) => Promise<void>;
  onComposerTextChange: (value: string) => void;
  onUpdateSelection: (target?: HTMLTextAreaElement | null) => void;
};

function getAttachmentFiles(items: FileList | File[]) {
  return Array.from(items).filter((file) => file.type.startsWith("image/") || file.type === "application/pdf");
}

export function SessionComposerInput({
  attachmentInputRef,
  composerInputRef,
  composerText,
  isPromptPending,
  onAddAttachments,
  onComposerTextChange,
  onUpdateSelection,
}: SessionComposerInputProps) {
  return (
    <div className="relative min-w-0">
      <input
        accept="image/*,application/pdf"
        className="hidden"
        multiple
        onChange={(event) => {
          if (event.currentTarget.files) {
            void onAddAttachments(event.currentTarget.files);
          }

          event.currentTarget.value = "";
        }}
        ref={attachmentInputRef}
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
          if (getAttachmentFiles(event.dataTransfer?.files ?? []).length > 0) {
            event.preventDefault();
          }
        }}
        onDrop={(event) => {
          const files = getAttachmentFiles(event.dataTransfer.files ?? []);

          if (files.length === 0) {
            return;
          }

          event.preventDefault();
          void onAddAttachments(files);
        }}
        onKeyUp={(event) => onUpdateSelection(event.currentTarget)}
        onPaste={(event) => {
          const files = getAttachmentFiles(event.clipboardData.files ?? []);

          if (files.length === 0) {
            return;
          }

          event.preventDefault();
          void onAddAttachments(files);
        }}
        onSelect={(event) => onUpdateSelection(event.currentTarget)}
        placeholder="Send a message, paste an image or PDF, or attach one"
        ref={composerInputRef}
        value={composerText}
      />
      <button
        aria-label="Attach file"
        className="absolute bottom-3 right-3 inline-flex min-h-11 min-w-11 items-center justify-center bg-white disabled:opacity-25"
        disabled={isPromptPending}
        onClick={() => attachmentInputRef.current?.click()}
        type="button"
      >
        <Icon className="size-6" icon="mdi:paperclip" />
      </button>
    </div>
  );
}
