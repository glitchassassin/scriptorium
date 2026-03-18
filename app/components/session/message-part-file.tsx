import type { OpencodeFilePart } from "~/lib/opencode/events";

type MessagePartFileProps = {
  part: OpencodeFilePart;
};

export function MessagePartFile({ part }: MessagePartFileProps) {
  const name = part.filename ?? part.url;
  const isImage = part.mime.startsWith("image/");

  return (
    <div className="pt-2 text-sm leading-6">
      {isImage ? (
        <div className="space-y-2">
          <img alt={name} className="max-h-72 w-auto border-2 border-black object-cover" src={part.url} />
          <p className="break-all opacity-60">{name}</p>
        </div>
      ) : (
        <>
          <p className="font-bold">File attachment</p>
          <p className="break-all opacity-60">{name}</p>
        </>
      )}
    </div>
  );
}
