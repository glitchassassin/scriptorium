import type { OpencodeFilePart } from "~/lib/opencode/events";

type MessagePartFileProps = {
  part: OpencodeFilePart;
};

export function MessagePartFile({ part }: MessagePartFileProps) {
  return (
    <div className="pt-2 text-sm leading-6">
      <p className="font-bold">File attachment</p>
      <p className="break-all opacity-60">{part.filename ?? part.url}</p>
    </div>
  );
}
