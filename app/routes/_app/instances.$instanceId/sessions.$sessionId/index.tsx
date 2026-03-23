import { useCallback, useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router";

import { MessageCard } from "~/components/session/message-card";
import { PermissionCard } from "~/components/session/permission-card";
import { SessionRevertDock } from "~/components/session/session-revert-dock";
import { TranscriptScrollableLayout } from "~/components/shell/transcript-scrollable-layout";
import { cn } from "~/lib/cn";
import { partitionMessagesByRevert } from "~/lib/opencode/message-helpers";
import { useMarkSessionReadOptimistic, useSession, useUnreadStatusEvents } from "~/store/sessions-provider";

import { type SessionRouteContext } from "./+/session-route";

function statusDescription(status: SessionRouteContext["status"]) {
  if (status.type !== "retry") {
    return null;
  }

  return `${status.message} Next retry at ${new Date(status.next).toLocaleTimeString()}.`;
}

export default function InstanceSessionTranscriptRoute() {
  const {
    hasLoadedFullHistory,
    instance,
    isLoadingFullHistory,
    loadFullHistory,
    messages,
    pendingPermissions,
    replyPermission,
    session,
    status,
  } = useOutletContext<SessionRouteContext>();
  const actionPath = `/instances/${instance.id}/sessions/${session.id}`;
  const { revertedMessages, visibleMessages } = partitionMessagesByRevert(messages, session.revert);
  const isBusy = status.type !== "idle";
  const isEmpty = visibleMessages.length === 0;
  const showCenteredEmptyState = isEmpty && !revertedMessages.length && pendingPermissions.length === 0;
  const emptyStateMessage = revertedMessages.length
    ? "All visible messages are currently reverted."
    : "No messages have been recorded for this session yet.";
  const sessionState = useSession(session.id);
  const markSessionReadOptimistic = useMarkSessionReadOptimistic();
  const [isWindowFocused, setIsWindowFocused] = useState(() => (typeof document === "undefined" ? true : document.hasFocus()));
  const [isDocumentVisible, setIsDocumentVisible] = useState(
    () => (typeof document === "undefined" ? true : document.visibilityState === "visible"),
  );
  const lastAckedAtRef = useRef<number | null>(null);

  const canAck = isWindowFocused && isDocumentVisible;
  const updatedAt = sessionState?.updatedAt ?? session.time.updated ?? session.time.created ?? 0;
  const lastReadAt = sessionState?.lastReadAt ?? null;
  const needsAck = updatedAt > 0 && (lastReadAt === null || updatedAt > lastReadAt);

  const submitAck = useCallback((activityAt: number) => {
    if ((lastAckedAtRef.current ?? 0) >= activityAt) {
      return;
    }

    lastAckedAtRef.current = activityAt;
    markSessionReadOptimistic(instance.id, session.id);

    const formData = new FormData();
    formData.set("instanceId", instance.id);
    formData.set("sessionId", session.id);
    void fetch("/session-read-status/ack", { body: formData, method: "POST" });
  }, [instance.id, markSessionReadOptimistic, session.id]);

  useEffect(() => {
    lastAckedAtRef.current = null;
  }, [session.id]);

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

  useUnreadStatusEvents(
    (event) => {
      if (!canAck) {
        return;
      }

      submitAck(event.updatedAt);
    },
    { instanceId: instance.id, sessionId: session.id },
  );

  useEffect(() => {
    if (!canAck || !needsAck) {
      return;
    }

    submitAck(updatedAt);
  }, [canAck, needsAck, submitAck, updatedAt]);

  return (
    <TranscriptScrollableLayout
      onReachTop={loadFullHistory}
      scrollContextKey={`transcript:${session.id}`}
    >
      <section className="flex min-h-full flex-1 flex-col gap-6 pr-1">
        {status.type === "retry" ? <p className="pt-4 text-sm leading-6">{statusDescription(status)}</p> : null}
        <section className={cn("space-y-0", showCenteredEmptyState && "flex flex-1 items-center justify-center px-4 text-center")}>
          {isLoadingFullHistory ? <p className="pt-4 text-sm leading-6">Loading earlier messages...</p> : null}
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
    </TranscriptScrollableLayout>
  );
}
