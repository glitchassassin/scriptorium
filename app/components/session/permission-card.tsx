import { PermissionPrompt } from "~/components/session/permission-prompt";
import type { OpencodeMessageWithParts, OpencodePermissionRequest } from "~/lib/opencode/events";

type PermissionCardProps = {
  messages: OpencodeMessageWithParts[];
  permissions: OpencodePermissionRequest[];
  onReply: (requestId: string, reply: "once" | "always" | "reject") => void;
};

export function PermissionCard({ messages, permissions, onReply }: PermissionCardProps) {
  if (!permissions.length) {
    return null;
  }

  return (
    <article className="flex justify-start">
      <div className="w-full space-y-3 px-3 py-3 text-left">
        <div className="flex items-baseline gap-3 justify-start">
          <p className="text-sm uppercase tracking-[0.08em]">Review Actions</p>
        </div>
        <div className="flex items-start gap-2 text-xs uppercase tracking-[0.08em] opacity-60">
          <div className="min-h-11 min-w-11 shrink-0" />
          <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
            <div />
            <div className="flex shrink-0 items-center gap-1">
              <span className="inline-flex min-h-11 min-w-11 items-center justify-center">Appr</span>
              <span className="inline-flex min-h-11 min-w-11 items-center justify-center">Alwy</span>
              <span className="inline-flex min-h-11 min-w-11 items-center justify-center">Deny</span>
            </div>
          </div>
        </div>
        <div className="space-y-1">
          {permissions.map((permission, index) => (
            <div
              className={index > 0 ? "border-t-2 border-black pt-3" : ""}
              key={permission.id}
            >
              <PermissionPrompt messages={messages} onReply={onReply} permission={permission} />
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
