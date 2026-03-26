import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router";

import { MessageCard } from "~/components/session/message-card";
import { PermissionCard } from "~/components/session/permission-card";
import { SessionRevertDock } from "~/components/session/session-revert-dock";
import { TranscriptScrollableLayout } from "~/components/shell/transcript-scrollable-layout";
import { cn } from "~/lib/cn";
import type { OpencodeSessionStatus } from "~/lib/opencode/events";
import { partitionMessagesByRevert } from "~/lib/opencode/message-helpers";
import { useMarkSessionReadOptimistic, useSession, useUnreadStatusEvents } from "~/store/sessions-provider";
import {
  useHasLoadedFullHistory,
  useSessionInfo,
  useSessionMessages,
  useSessionPermissions,
  useSessionStatus,
} from "~/routes/_app/instances.$instanceId/sessions.$sessionId/+/session-live";

import type { Route } from "./+types/index";
import { type SessionRouteContext } from "./+/session-route";

function statusDescription(status: OpencodeSessionStatus) {
  if (status.type !== "retry") {
    return null;
  }

  return `${status.message} Next retry at ${new Date(status.next).toLocaleTimeString()}.`;
}

export default function InstanceSessionTranscriptRoute() {
  const {
    actionPath,
    instance,
    isLoadingFullHistory: hasRequestedFullHistory,
    loadFullHistory,
  } = useOutletContext<SessionRouteContext>();
  const hasLoadedFullHistory = useHasLoadedFullHistory();
  const messages = useSessionMessages();
  const { pendingPermissions, replyPermission } = useSessionPermissions();
  const session = useSessionInfo();
  const status = useSessionStatus();
  const isLoadingFullHistory = hasRequestedFullHistory && !hasLoadedFullHistory;
  const { revertedMessages, visibleMessages } = useMemo(
    () => partitionMessagesByRevert(messages, session.revert),
    [messages, session.revert],
  );
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
  const handleLoadFullHistory = useCallback(() => {
    if (hasLoadedFullHistory || isLoadingFullHistory) {
      return;
    }

    loadFullHistory();
  }, [hasLoadedFullHistory, isLoadingFullHistory, loadFullHistory]);

  const submitAck = useCallback((activityAt: number) => {
    if ((lastAckedAtRef.current ?? 0) >= activityAt) {
      return;
    }

    lastAckedAtRef.current = activityAt;
    markSessionReadOptimistic(session.id);

    const formData = new FormData();
    formData.set("sessionId", session.id);
    void fetch("/session-read-status/ack", { body: formData, method: "POST" });
  }, [markSessionReadOptimistic, session.id]);

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
      onReachTop={handleLoadFullHistory}
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
