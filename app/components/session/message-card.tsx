import { MessagePartView } from "~/components/session/message-part-view";
import type { OpencodeMessageWithParts } from "~/lib/opencode/events";

type MessageCardProps = {
  message: OpencodeMessageWithParts;
};

export function MessageCard({ message }: MessageCardProps) {
  const isUser = message.info.role === "user";
  const visibleParts = message.parts.filter((part) => {
    if (part.type === "text") {
      return !part.ignored && !(isUser && part.synthetic);
    }

    if (part.type === "reasoning") {
      return true;
    }

    return !isUser;
  });

  if (visibleParts.length === 0 && !(message.info.role === "assistant" && message.info.error)) {
    return null;
  }

  return (
    <article className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`${isUser ? "max-w-[42rem]" : "w-full"} space-y-3 px-3 py-3 text-left`}>
        <div className="flex items-baseline gap-3 justify-start">
          <p className="text-sm uppercase tracking-[0.08em]">{message.info.role}</p>
        </div>
        <div className="space-y-3">
          {visibleParts.length ? (
            visibleParts.map((part) => <MessagePartView key={part.id} part={part} role={message.info.role} />)
          ) : (
            <p className="text-sm leading-6 opacity-60">Waiting for content...</p>
          )}
        </div>
        {message.info.role === "assistant" && message.info.error ? (
          <p className="pt-2 text-sm leading-6">{message.info.error.message ?? message.info.error.name}</p>
        ) : null}
      </div>
    </article>
  );
}
