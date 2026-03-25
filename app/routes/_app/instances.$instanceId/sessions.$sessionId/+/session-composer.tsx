import safeArea from "~/styles/safe-area.module.css";
import type { OpencodeCommandInfo, OpencodeModelRef, OpencodeProvider } from "~/lib/opencode/events";
import { SessionComposerCommandDescriptionTray, SessionComposerCommandListTray } from "./session-composer-command-tray";
import { SessionComposerControls } from "./session-composer-controls";
import { SessionComposerImagesTray } from "./session-composer-images-tray";
import { SessionComposerInput } from "./session-composer-input";
import { SessionComposerModelTray } from "./session-composer-model-tray";
import { SessionComposerStatus } from "./session-composer-status";
import { useSessionComposerController } from "./use-session-composer-controller";

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
  const controller = useSessionComposerController({
    agents,
    commands,
    defaultAgent,
    defaultModel,
    defaultVariant,
    insertReferenceEvents,
    onClearSessionError,
    prefilledPrompt,
    providers,
    sessionId,
  });

  return (
    <div className={`${safeArea.footerPad4} relative border-t-2 border-black px-6 pt-4 sm:px-8`}>
      <SessionComposerStatus
        abortError={controller.abortError}
        commandError={controller.commandError}
        isRestoringAttachments={controller.isRestoringAttachments}
        promptError={controller.promptError}
        sessionError={sessionError}
      />

      {controller.visibleTray === "images" ? (
        <SessionComposerImagesTray images={controller.images} onRemoveImage={controller.onRemoveImage} />
      ) : null}

      {controller.visibleTray === "commands-list" ? (
        <SessionComposerCommandListTray
          commands={controller.commands}
          isDisabled={isBusy || controller.isCommandPending}
          onCommand={controller.onCommand}
        />
      ) : null}

      {controller.visibleTray === "commands-description" && controller.commandDescription ? (
        <SessionComposerCommandDescriptionTray commandDescription={controller.commandDescription} />
      ) : null}

      {controller.visibleTray === "model" ? (
        <SessionComposerModelTray
          collapsedProviderIDs={controller.collapsedProviderIDs}
          modelGroups={controller.modelGroups}
          modelSearch={controller.modelSearch}
          onModelSearchChange={controller.onModelSearchChange}
          onModelSelect={controller.onModelSelect}
          onProviderToggle={controller.onProviderToggle}
          selectedModel={controller.selectedModel}
        />
      ) : null}

      <div className="mt-3">
        <form className="min-w-0" onSubmit={(event) => {
          event.preventDefault();
          controller.onSubmit();
        }}>
          <div className="space-y-2">
            <SessionComposerInput
              composerInputRef={controller.composerInputRef}
              composerText={controller.composerText}
              imageInputRef={controller.imageInputRef}
              isPromptPending={controller.isPromptPending}
              onAddImages={controller.onAddImages}
              onComposerTextChange={controller.onComposerTextChange}
              onUpdateSelection={controller.onUpdateSelection}
            />

            <SessionComposerControls
              agents={agents}
              currentVariant={controller.currentVariant}
              isAbortPending={controller.isAbortPending}
              isBusy={isBusy}
              isPromptPending={controller.isPromptPending}
              onAbort={controller.onAbort}
              onCommandsToggle={controller.onCommandsToggle}
              onCycleAgent={controller.onCycleAgent}
              onModelToggle={controller.onModelToggle}
              onSubmit={controller.onSubmit}
              onVariantCycle={controller.onVariantCycle}
              providers={providers}
              selectedAgent={controller.selectedAgent}
              selectedModel={controller.selectedModel}
              variantOptions={controller.variantOptions}
              visibleTray={controller.visibleTray}
            />
          </div>
        </form>
      </div>
    </div>
  );
}
