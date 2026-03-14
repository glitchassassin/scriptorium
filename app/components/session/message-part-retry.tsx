import type { OpencodeRetryPart } from "~/lib/opencode/events";

type MessagePartRetryProps = {
  part: OpencodeRetryPart;
};

export function MessagePartRetry({ part }: MessagePartRetryProps) {
  return (
    <p className="pt-2 text-sm leading-6 opacity-60">
      Retry {part.attempt}: {part.error.message ?? "Request failed."}
    </p>
  );
}
