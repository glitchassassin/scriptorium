import { memo, useMemo } from "react";
import { Form } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import { MessagePartView } from "~/components/session/message-part-view";
import type { OpencodeMessageWithParts } from "~/lib/opencode/events";

type MessageCardProps = {
  actionPath?: string;
  message: OpencodeMessageWithParts;
  isSessionBusy?: boolean;
};

export const MessageCard = memo(function MessageCard({ actionPath, message, isSessionBusy = false }: MessageCardProps) {
  const isUser = message.info.role === "user";
  const visibleParts = useMemo(
    () => message.parts.filter((part) => {
      if (part.type === "text") {
        return !part.ignored && !(isUser && part.synthetic);
      }

      if (part.type === "reasoning") {
        return true;
      }

      if (part.type === "file") {
        return true;
      }

      return !isUser;
    }),
    [isUser, message.parts],
  );

  if (visibleParts.length === 0 && !(message.info.role === "assistant" && message.info.error)) {
    return null;
  }

  return (
    <article className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`${isUser ? "max-w-[42rem]" : "w-full"} space-y-3 px-3 py-3 text-left`}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm uppercase tracking-[0.08em]">{message.info.role}</p>
          {isUser && actionPath ? (
            <div className="flex items-center gap-1">
              <Form action={actionPath} method="post">
                <input name="intent" type="hidden" value="revert" />
                <input name="messageId" type="hidden" value={message.info.id} />
                <button
                  aria-label="Undo from this message"
                  className="inline-flex min-h-9 min-w-9 items-center justify-center disabled:opacity-25"
                  disabled={isSessionBusy}
                  title="Undo from this message"
                  type="submit"
                >
                  <Icon className="size-5" icon="mdi:undo-variant" />
                </button>
              </Form>
              <Form action={actionPath} method="post">
                <input name="intent" type="hidden" value="fork" />
                <input name="messageId" type="hidden" value={message.info.id} />
                <button
                  aria-label="Fork from this message"
                  className="inline-flex min-h-9 min-w-9 items-center justify-center"
                  title="Fork from this message"
                  type="submit"
                >
                  <Icon className="size-5" icon="mdi:source-fork" />
                </button>
              </Form>
            </div>
          ) : null}
        </div>
        <div className="space-y-3">
          {visibleParts.length ? (
            visibleParts.map((part) => (
              <MessagePartView
                key={part.id}
                part={part}
                role={message.info.role}
              />
            ))
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
});
