import { ComposerHorizontalTray, ComposerPanelTray, ComposerTrayFrame } from "~/components/ui/composer-trays";
import type { OpencodeCommandInfo } from "~/lib/opencode/events";

export function SessionComposerCommandListTray({
  commands,
  isDisabled,
  onCommand,
}: {
  commands: OpencodeCommandInfo[];
  isDisabled: boolean;
  onCommand: (commandName: string) => void;
}) {
  return (
    <ComposerTrayFrame>
      <ComposerHorizontalTray>
        {commands.map((command) => (
          <button
            aria-label={`Insert /${command.name}`}
            className="min-h-11 shrink-0 bg-white px-3 py-2 text-base disabled:opacity-25"
            disabled={isDisabled}
            key={command.name}
            onClick={() => onCommand(command.name)}
            type="button"
          >
            /{command.name}
          </button>
        ))}
      </ComposerHorizontalTray>
    </ComposerTrayFrame>
  );
}

export function SessionComposerCommandDescriptionTray({ commandDescription }: { commandDescription: string }) {
  return (
    <ComposerTrayFrame>
      <ComposerPanelTray title="Command">
        <p className="text-base leading-6">{commandDescription}</p>
      </ComposerPanelTray>
    </ComposerTrayFrame>
  );
}
