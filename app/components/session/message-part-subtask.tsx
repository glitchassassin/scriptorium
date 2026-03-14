import type { OpencodeSubtaskPart } from "~/lib/opencode/events";

type MessagePartSubtaskProps = {
  part: OpencodeSubtaskPart;
};

export function MessagePartSubtask({ part }: MessagePartSubtaskProps) {
  return (
    <div className="pt-2 text-sm leading-6">
      <p className="font-bold">Subtask: {part.description}</p>
      <p className="whitespace-pre-wrap break-words opacity-60">{part.prompt}</p>
    </div>
  );
}
