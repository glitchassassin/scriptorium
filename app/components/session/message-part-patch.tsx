import type { OpencodePatchPart } from "~/lib/opencode/events";

type MessagePartPatchProps = {
  part: OpencodePatchPart;
};

export function MessagePartPatch({ part }: MessagePartPatchProps) {
  return (
    <p className="pt-2 text-sm leading-6 opacity-60">
      Patch updated {part.files.length} file{part.files.length === 1 ? "" : "s"}.
    </p>
  );
}
