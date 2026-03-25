import { Icon } from "@iconify/react";

import { ComposerHorizontalTray, ComposerTrayFrame } from "~/components/ui/composer-trays";
import type { DraftImage } from "./session-composer-draft";

export function SessionComposerImagesTray({
  images,
  onRemoveImage,
}: {
  images: DraftImage[];
  onRemoveImage: (id: string) => Promise<void>;
}) {
  if (!images.length) {
    return null;
  }

  return (
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
  );
}
