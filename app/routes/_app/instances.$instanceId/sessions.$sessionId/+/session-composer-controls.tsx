import { Icon } from "@iconify/react";

import { cn } from "~/lib/cn";
import type { OpencodeProvider } from "~/lib/opencode/events";
import { getModelLabel } from "~/lib/opencode/models";
import type { VisibleTray } from "./session-composer-types";

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

export function SessionComposerControls({
  agents,
  currentVariant,
  isAbortPending,
  isBusy,
  isPromptPending,
  onAbort,
  onCommandsToggle,
  onCycleAgent,
  onModelToggle,
  onSubmit,
  onVariantCycle,
  providers,
  selectedAgent,
  selectedModel,
  variantOptions,
  visibleTray,
}: {
  agents: string[];
  currentVariant: string | null;
  isAbortPending: boolean;
  isBusy: boolean;
  isPromptPending: boolean;
  onAbort: () => void;
  onCommandsToggle: () => void;
  onCycleAgent: () => void;
  onModelToggle: () => void;
  onSubmit: () => void;
  onVariantCycle: () => void;
  providers: OpencodeProvider[];
  selectedAgent: string | null;
  selectedModel: { providerID: string; modelID: string } | null;
  variantOptions: string[];
  visibleTray: VisibleTray;
}) {
  return (
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
          {selectedModel ? getModelLabel(selectedModel, providers) : "Default"}
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
  );
}
