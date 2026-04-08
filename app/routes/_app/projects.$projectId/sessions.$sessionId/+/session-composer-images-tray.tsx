import { Icon } from "@iconify/react";

import { ComposerHorizontalTray, ComposerTrayFrame } from "~/components/ui/composer-trays";
import type { DraftAttachment } from "./session-composer-draft";

function isImage(type: string) {
  return type.startsWith("image/");
}

export function SessionComposerImagesTray({
  attachments,
  onRemoveAttachment,
}: {
  attachments: DraftAttachment[];
  onRemoveAttachment: (id: string) => Promise<void>;
}) {
  if (!attachments.length) {
    return null;
  }

  return (
    <ComposerTrayFrame>
      <ComposerHorizontalTray>
        {attachments.map((attachment) => (
          <div aria-label={attachment.file.name} className="relative size-20 overflow-hidden border-2 border-black bg-white" key={attachment.id}>
            {isImage(attachment.file.type)
              ? <img alt={attachment.file.name} className="size-full object-cover" src={attachment.preview} />
              : (
                <div className="flex size-full items-center justify-center p-2 text-center text-xs font-bold leading-4">
                  <span className="line-clamp-3 break-words">{attachment.file.name}</span>
                </div>
              )}
            <button
              aria-label={`Remove ${attachment.file.name}`}
              className="absolute right-1 top-1 inline-flex size-6 items-center justify-center border-2 border-black bg-white"
              onClick={() => void onRemoveAttachment(attachment.id)}
              type="button"
            >
              <Icon className="size-4" icon="mdi:close" />
            </button>
          </div>
        ))}
      </ComposerHorizontalTray>
    </ComposerTrayFrame>
  );
}
