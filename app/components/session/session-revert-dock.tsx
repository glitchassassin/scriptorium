import { Form } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import { getUserMessageText } from "~/lib/opencode/message-helpers";
import type { OpencodeMessageWithParts } from "~/lib/opencode/events";

type SessionRevertDockProps = {
  actionPath?: string;
  messages: OpencodeMessageWithParts[];
  isSessionBusy?: boolean;
};

function listMessageFiles(messages: OpencodeMessageWithParts[]) {
  const files = new Set<string>();

  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type !== "patch") {
        continue;
      }

      for (const file of part.files) {
        files.add(file);
      }
    }
  }

  return [...files];
}

function groupRevertedTurns(messages: OpencodeMessageWithParts[]) {
  const turns: Array<{ userMessage: OpencodeMessageWithParts; files: string[] }> = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];

    if (message?.info.role !== "user") {
      continue;
    }

    let nextUserIndex = messages.length;

    for (let scanIndex = index + 1; scanIndex < messages.length; scanIndex += 1) {
      if (messages[scanIndex]?.info.role === "user") {
        nextUserIndex = scanIndex;
        break;
      }
    }

    turns.push({
      userMessage: message,
      files: listMessageFiles(messages.slice(index, nextUserIndex)),
    });
  }

  return turns;
}

export function SessionRevertDock({ actionPath, messages, isSessionBusy = false }: SessionRevertDockProps) {
  if (!messages.length) {
    return null;
  }

  const revertedTurns = groupRevertedTurns(messages);

  if (!revertedTurns.length) {
    return null;
  }

  return (
    <section className="my-8 space-y-3 border-y-2 border-black px-3 py-4">
      <div className="flex items-center gap-2 text-sm uppercase tracking-[0.08em]">
        <Icon className="size-4" icon="mdi:redo-variant" />
        Reverted messages
      </div>
      <div className="space-y-2">
        {revertedTurns.map(({ userMessage, files }, index) => {
          const text = getUserMessageText(userMessage) ?? userMessage.info.id.slice(0, 12);
            const nextMessage = revertedTurns[index + 1]?.userMessage ?? null;

          return (
            <div className="space-y-1 border-l-2 border-black pl-3" key={userMessage.info.id}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 flex-1 text-sm leading-6">{text}</p>
                <div className="flex shrink-0 items-center gap-1 self-start">
                  <Form action={actionPath} method="post">
                    <input name="intent" type="hidden" value={nextMessage ? "revert" : "unrevert"} />
                    {nextMessage ? <input name="messageId" type="hidden" value={nextMessage.info.id} /> : null}
                    <button
                      aria-label={`Redo from message ${text}`}
                      className="inline-flex min-h-9 min-w-9 items-center justify-center disabled:opacity-25"
                      disabled={isSessionBusy}
                      title="Redo from this message"
                      type="submit"
                    >
                      <Icon className="size-5" icon="mdi:redo-variant" />
                    </button>
                  </Form>
                  <Form action={actionPath} method="post">
                    <input name="intent" type="hidden" value="fork" />
                    <input name="messageId" type="hidden" value={userMessage.info.id} />
                    <button
                      aria-label={`Fork from message ${text}`}
                      className="inline-flex min-h-9 min-w-9 items-center justify-center"
                      title="Fork from this message"
                      type="submit"
                    >
                      <Icon className="size-5" icon="mdi:source-fork" />
                    </button>
                  </Form>
                </div>
              </div>
              {files.length ? <p className="text-sm leading-6 opacity-60">{files.join(", ")}</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
