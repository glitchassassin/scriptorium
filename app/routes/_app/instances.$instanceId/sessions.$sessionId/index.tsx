import { useEffect, useRef } from "react";
import { useOutletContext } from "react-router";

import { MessageCard } from "~/components/session/message-card";
import { PermissionCard } from "~/components/session/permission-card";

import { type SessionRouteContext } from "./+/session-route";

function statusDescription(status: SessionRouteContext["status"]) {
  if (status.type !== "retry") {
    return null;
  }

  return `${status.message} Next retry at ${new Date(status.next).toLocaleTimeString()}.`;
}

export default function InstanceSessionTranscriptRoute() {
  const { messages, pendingPermissions, replyPermission, status } = useOutletContext<SessionRouteContext>();
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasLoadedSessionRef = useRef(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({
        behavior: hasLoadedSessionRef.current ? "smooth" : "auto",
        block: "end",
      });
      hasLoadedSessionRef.current = true;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages, pendingPermissions.length, status.type]);

  return (
    <section className="space-y-6 pr-1">
      {status.type === "retry" ? <p className="pt-4 text-sm leading-6">{statusDescription(status)}</p> : null}
      {messages.length ? (
        <section className="space-y-0">
          {messages.map((message) => (
            <MessageCard key={message.info.id} message={message} />
          ))}
          <PermissionCard messages={messages} onReply={replyPermission} permissions={pendingPermissions} />
        </section>
      ) : (
        <section className="space-y-4 pt-4">
          <p className="text-base leading-6">No messages have been recorded for this session yet.</p>
          <PermissionCard messages={messages} onReply={replyPermission} permissions={pendingPermissions} />
        </section>
      )}
      <div ref={bottomRef} />
    </section>
  );
}
