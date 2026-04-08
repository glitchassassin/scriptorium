import { useFetcher } from "react-router";

type OpencodeStoppedStateProps = {
  action: string;
  detail: string;
  title?: string;
};

export function OpencodeStoppedState({ action, detail, title = "OpenCode is stopped." }: OpencodeStoppedStateProps) {
  const fetcher = useFetcher<{ error: string | null }>();
  const isStarting = fetcher.state !== "idle";

  return (
    <section className="space-y-4 border-t-2 border-black px-6 py-4 sm:px-8">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.08em]">Runtime</p>
        <p className="text-base leading-6">{title}</p>
        <p className="text-base leading-6 italic">{detail}</p>
      </div>
      <fetcher.Form action={action} method="post">
        <button
          className="min-h-11 bg-black px-3 py-2 text-base text-white disabled:opacity-25"
          disabled={isStarting}
          name="intent"
          type="submit"
          value="start-opencode"
        >
          {isStarting ? "Starting OpenCode" : "Start OpenCode"}
        </button>
      </fetcher.Form>
      {fetcher.data?.error ? <p className="text-base leading-6">{fetcher.data.error}</p> : null}
    </section>
  );
}
