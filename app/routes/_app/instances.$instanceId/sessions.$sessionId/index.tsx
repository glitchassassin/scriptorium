import { useCallback, useEffect, useState } from "react";
import { useFetcher, useOutletContext } from "react-router";

import { MessageCard } from "~/components/session/message-card";
import { PermissionCard } from "~/components/session/permission-card";
import { SessionRevertDock } from "~/components/session/session-revert-dock";
import { cn } from "~/lib/cn";
import { partitionMessagesByRevert } from "~/lib/opencode/message-helpers";
import { useMarkSessionReadOptimistic, useSessionUnreadStatus } from "~/store/sessions-provider";

import { type SessionRouteContext } from "./+/session-route";

function statusDescription(status: SessionRouteContext["status"]) {
  if (status.type !== "retry") {
    return null;
  }

  return `${status.message} Next retry at ${new Date(status.next).toLocaleTimeString()}.`;
}

export default function InstanceSessionTranscriptRoute() {
  const { instance, messages, pendingPermissions, replyPermission, session, status } = useOutletContext<SessionRouteContext>();
  const ackFetcher = useFetcher();
  const actionPath = `/instances/${instance.id}/sessions/${session.id}`;
  const { revertedMessages, visibleMessages } = partitionMessagesByRevert(messages, session.revert);
  const isBusy = status.type !== "idle";
  const isEmpty = visibleMessages.length === 0;
  const showCenteredEmptyState = isEmpty && !revertedMessages.length && pendingPermissions.length === 0;
  const emptyStateMessage = revertedMessages.length
    ? "All visible messages are currently reverted."
    : "No messages have been recorded for this session yet.";
  const isUnread = useSessionUnreadStatus(instance.id, session.id);
  const markSessionReadOptimistic = useMarkSessionReadOptimistic();
  const [isWindowFocused, setIsWindowFocused] = useState(() => (typeof document === "undefined" ? true : document.hasFocus()));
  const [isDocumentVisible, setIsDocumentVisible] = useState(
    () => (typeof document === "undefined" ? true : document.visibilityState === "visible"),
  );

  const canAck = isWindowFocused && isDocumentVisible;

  const submitAck = useCallback(() => {
    markSessionReadOptimistic(instance.id, session.id);

    const formData = new FormData();
    formData.set("instanceId", instance.id);
    formData.set("sessionId", session.id);
    ackFetcher.submit(formData, { action: "/session-read-status/ack", method: "post" });
  }, [ackFetcher, instance.id, markSessionReadOptimistic, session.id]);

  useEffect(() => {
    function handleFocus() {
      setIsWindowFocused(true);
    }

    function handleBlur() {
      setIsWindowFocused(false);
    }

    function handleVisibilityChange() {
      setIsDocumentVisible(document.visibilityState === "visible");
    }

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!canAck || ackFetcher.state !== "idle" || !isUnread) {
      return;
    }

    submitAck();
  }, [ackFetcher.state, canAck, isUnread, submitAck]);

  return (
    <section className="flex min-h-full flex-1 flex-col gap-6 pr-1">
      {status.type === "retry" ? <p className="pt-4 text-sm leading-6">{statusDescription(status)}</p> : null}
      <section className={cn("space-y-0", showCenteredEmptyState && "flex flex-1 items-center justify-center px-4 text-center")}>
        {isEmpty ? <p className={cn("text-base leading-6", !showCenteredEmptyState && "pt-4")}>{emptyStateMessage}</p> : null}
        {visibleMessages.map((message) => (
          <MessageCard actionPath={actionPath} isSessionBusy={isBusy} key={message.info.id} message={message} />
        ))}
        {revertedMessages.length ? (
          <SessionRevertDock actionPath={actionPath} isSessionBusy={isBusy} messages={revertedMessages} />
        ) : null}
        <PermissionCard messages={visibleMessages} onReply={replyPermission} permissions={pendingPermissions} />
      </section>
    </section>
  );
}
