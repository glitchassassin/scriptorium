import safeArea from "~/styles/safe-area.module.css";
import type { OpencodeAgent, OpencodeCommandInfo, OpencodeModelRef, OpencodeProvider } from "~/lib/opencode/events";
import type { SessionModelChoice } from "~/lib/opencode/models";
import {
  SessionComposerCommandDescriptionTray,
  SessionComposerCommandListTray,
  SessionComposerSubagentDescriptionTray,
  SessionComposerSubagentListTray,
} from "./session-composer-command-tray";
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
  recentModels?: SessionModelChoice[];
  sessionError: string | null;
  sessionId: string;
  subagents?: OpencodeAgent[];
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
  recentModels = [],
  sessionError,
  sessionId,
  subagents = [],
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
    recentModels,
    sessionId,
    subagents,
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
        <SessionComposerImagesTray attachments={controller.attachments} onRemoveAttachment={controller.onRemoveAttachment} />
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

      {controller.visibleTray === "subagents-list" ? (
        <SessionComposerSubagentListTray
          isDisabled={isBusy || controller.isCommandPending}
          onSubagent={controller.onSubagent}
          subagents={controller.subagents}
        />
      ) : null}

      {controller.visibleTray === "subagents-description" && controller.subagentDescription ? (
        <SessionComposerSubagentDescriptionTray subagentDescription={controller.subagentDescription} />
      ) : null}

      {controller.visibleTray === "model" ? (
        <SessionComposerModelTray
          collapsedProviderIDs={controller.collapsedProviderIDs}
          modelGroups={controller.modelGroups}
          modelSearch={controller.modelSearch}
          onModelSearchChange={controller.onModelSearchChange}
          onModelSelect={controller.onModelSelect}
          onProviderToggle={controller.onProviderToggle}
          recentModels={controller.recentModels}
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
              attachmentInputRef={controller.attachmentInputRef}
              composerInputRef={controller.composerInputRef}
              composerText={controller.composerText}
              isPromptPending={controller.isPromptPending}
              onAddAttachments={controller.onAddAttachments}
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
              onSubagentsToggle={controller.onSubagentsToggle}
              onVariantCycle={controller.onVariantCycle}
              providers={providers}
              selectedAgent={controller.selectedAgent}
              selectedModel={controller.selectedModel}
              subagents={controller.subagents}
              variantOptions={controller.variantOptions}
              visibleTray={controller.visibleTray}
            />
          </div>
        </form>
      </div>
    </div>
  );
}
