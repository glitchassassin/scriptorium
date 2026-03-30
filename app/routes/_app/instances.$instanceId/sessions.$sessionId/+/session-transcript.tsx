import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRevalidator } from "react-router";

import { useInstanceEvents } from "~/components/events/instance-events-provider";
import { MessageCard } from "~/components/session/message-card";
import { PermissionCard } from "~/components/session/permission-card";
import { QuestionCard } from "~/components/session/question-card";
import { SessionRevertDock } from "~/components/session/session-revert-dock";
import { ScrollableLayout } from "~/components/shell/scrollable-layout";
import { useStickyBottomScroll } from "~/components/shell/use-sticky-bottom-scroll";
import { cn } from "~/lib/cn";
import {
  listOpencodeMessagePageClient,
  rejectOpencodeQuestionRequest,
  replyToOpencodePermissionRequest,
  replyToOpencodeQuestionRequest,
} from "~/lib/instances/opencode.client";
import type {
  OpencodeMessageWithParts,
  OpencodePermissionRequest,
  OpencodeQuestionAnswer,
  OpencodeQuestionRequest,
  OpencodeSessionInfo,
  OpencodeSessionStatus,
} from "~/lib/opencode/events";
import { partitionMessagesByRevert } from "~/lib/opencode/message-helpers";
import { SESSION_MESSAGE_PAGE_SIZE } from "~/lib/opencode/message-page";
import {
  applyMessagePartDelta,
  mergeMessages,
  removeMessage,
  removeMessagePart,
  upsertMessage,
  upsertMessagePart,
} from "~/lib/opencode/message-state";

const DEFAULT_TOP_TOLERANCE_PX = 8;

const TRANSCRIPT_EVENT_TYPES = [
  "message.updated",
  "message.removed",
  "message.part.updated",
  "message.part.delta",
  "message.part.removed",
  "permission.asked",
  "permission.replied",
  "question.asked",
  "question.replied",
  "question.rejected",
] as const;

type SessionTranscriptProps = {
  actionPath: string;
  initialHistoryCursor: string | null;
  initialMessages: OpencodeMessageWithParts[];
  initialPermissions: OpencodePermissionRequest[];
  initialQuestions: OpencodeQuestionRequest[];
  instanceId: string;
  session: OpencodeSessionInfo;
  status: OpencodeSessionStatus;
};

function statusDescription(status: OpencodeSessionStatus) {
  if (status.type !== "retry") {
    return null;
  }

  return `${status.message} Next retry at ${new Date(status.next).toLocaleTimeString()}.`;
}

export function SessionTranscript({
  actionPath,
  initialHistoryCursor,
  initialMessages,
  initialPermissions,
  initialQuestions,
  instanceId,
  session,
  status,
}: SessionTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pendingPrependBottomOffsetRef = useRef<number | null>(null);
  const hasReachedTopRef = useRef(false);
  const historyRequestRef = useRef(0);
  const isLoadingHistoryRef = useRef(false);
  const shouldReplaceFromLoaderRef = useRef(true);
  const sessionIdRef = useRef(session.id);
  const revalidator = useRevalidator();
  const revalidatorRef = useRef(revalidator);
  const [messages, setMessages] = useState<OpencodeMessageWithParts[]>(initialMessages);
  const [pendingPermissions, setPendingPermissions] = useState<OpencodePermissionRequest[]>(initialPermissions);
  const [pendingQuestions, setPendingQuestions] = useState<OpencodeQuestionRequest[]>(initialQuestions);
  const [historyCursor, setHistoryCursor] = useState<string | null>(initialHistoryCursor);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [prependRevision, setPrependRevision] = useState(0);

  revalidatorRef.current = revalidator;

  const requestRevalidation = useCallback(() => {
    void revalidatorRef.current.revalidate();
  }, []);

  useStickyBottomScroll({
    contentRef,
    scrollContextKey: `transcript:${session.id}`,
    scrollRef,
  });

  const loadMoreHistory = useCallback(async () => {
    if (!historyCursor || isLoadingHistoryRef.current) {
      return;
    }

    const requestId = historyRequestRef.current + 1;
    const requestSessionId = sessionIdRef.current;

    historyRequestRef.current = requestId;
    isLoadingHistoryRef.current = true;
    setIsLoadingHistory(true);

    try {
      const page = await listOpencodeMessagePageClient(instanceId, requestSessionId, {
        before: historyCursor,
        limit: SESSION_MESSAGE_PAGE_SIZE,
      });

      if (historyRequestRef.current !== requestId || sessionIdRef.current !== requestSessionId) {
        return;
      }

      if (page.items.length > 0 && scrollRef.current) {
        pendingPrependBottomOffsetRef.current = Math.max(
          scrollRef.current.scrollHeight - scrollRef.current.scrollTop,
          0,
        );
        shouldReplaceFromLoaderRef.current = false;
      }

      setMessages((current) => mergeMessages(current, page.items));
      setHistoryCursor(page.nextCursor);

      if (page.items.length > 0) {
        setPrependRevision((current) => current + 1);
      }
      } catch {
        if (historyRequestRef.current === requestId && sessionIdRef.current === requestSessionId) {
          requestRevalidation();
        }
      } finally {
      if (historyRequestRef.current === requestId && sessionIdRef.current === requestSessionId) {
        isLoadingHistoryRef.current = false;
        setIsLoadingHistory(false);
      }
    }
  }, [historyCursor, instanceId, requestRevalidation]);

  useEffect(() => {
    if (sessionIdRef.current === session.id) {
      if (shouldReplaceFromLoaderRef.current) {
        setMessages(initialMessages);
        setHistoryCursor(initialHistoryCursor);
      } else {
        setMessages((current) => mergeMessages(current, initialMessages));
      }

      setPendingPermissions(initialPermissions);
      setPendingQuestions(initialQuestions);
      return;
    }

    sessionIdRef.current = session.id;
    historyRequestRef.current += 1;
    isLoadingHistoryRef.current = false;
    shouldReplaceFromLoaderRef.current = true;
    pendingPrependBottomOffsetRef.current = null;
    hasReachedTopRef.current = false;
    setMessages(initialMessages);
    setPendingPermissions(initialPermissions);
    setPendingQuestions(initialQuestions);
    setHistoryCursor(initialHistoryCursor);
    setIsLoadingHistory(false);
    setPrependRevision(0);
  }, [initialHistoryCursor, initialMessages, initialPermissions, initialQuestions, session.id]);

  useEffect(() => {
    shouldReplaceFromLoaderRef.current = true;
    requestRevalidation();
  }, [requestRevalidation, session.id]);

  const replyPermission = useCallback(
    async (requestId: string, reply: "once" | "always" | "reject") => {
      setPendingPermissions((current) => current.filter((permission) => permission.id !== requestId));

      try {
        await replyToOpencodePermissionRequest(instanceId, requestId, reply);
      } catch {
        requestRevalidation();
      }
    },
    [instanceId, requestRevalidation],
  );

  const replyQuestion = useCallback(
    async (requestId: string, answers: OpencodeQuestionAnswer[]) => {
      setPendingQuestions((current) => current.filter((question) => question.id !== requestId));

      try {
        await replyToOpencodeQuestionRequest(instanceId, requestId, answers);
      } catch {
        requestRevalidation();
      }
    },
    [instanceId, requestRevalidation],
  );

  const rejectQuestion = useCallback(
    async (requestId: string) => {
      setPendingQuestions((current) => current.filter((question) => question.id !== requestId));

      try {
        await rejectOpencodeQuestionRequest(instanceId, requestId);
      } catch {
        requestRevalidation();
      }
    },
    [instanceId, requestRevalidation],
  );

  useInstanceEvents(
    (event) => {
      switch (event.type) {
        case "message.updated": {
          shouldReplaceFromLoaderRef.current = false;
          setMessages((current) => upsertMessage(current, event.properties.info));
          return;
        }

        case "message.removed": {
          shouldReplaceFromLoaderRef.current = false;
          setMessages((current) => removeMessage(current, event.properties.messageID));
          return;
        }

        case "message.part.updated": {
          shouldReplaceFromLoaderRef.current = false;
          setMessages((current) => upsertMessagePart(current, event.properties.part));
          return;
        }

        case "message.part.delta": {
          shouldReplaceFromLoaderRef.current = false;
          setMessages((current) =>
            applyMessagePartDelta(
              current,
              event.properties.messageID,
              event.properties.partID,
              event.properties.field,
              event.properties.delta,
            ),
          );
          return;
        }

        case "message.part.removed": {
          shouldReplaceFromLoaderRef.current = false;
          setMessages((current) => removeMessagePart(current, event.properties.messageID, event.properties.partID));
          return;
        }

        case "permission.asked": {
          setPendingPermissions((current) =>
            current.some((permission) => permission.id === event.properties.id)
              ? current
              : [...current, event.properties],
          );
          return;
        }

        case "permission.replied": {
          setPendingPermissions((current) =>
            current.filter((permission) => permission.id !== event.properties.requestID),
          );
          return;
        }

        case "question.asked": {
          setPendingQuestions((current) =>
            current.some((question) => question.id === event.properties.id)
              ? current.map((question) =>
                  question.id === event.properties.id ? event.properties : question,
                )
              : [...current, event.properties],
          );
          return;
        }

        case "question.replied":
        case "question.rejected": {
          setPendingQuestions((current) =>
            current.filter((question) => question.id !== event.properties.requestID),
          );
          return;
        }

        default:
          return;
      }
    },
    { instanceId, sessionId: session.id, types: TRANSCRIPT_EVENT_TYPES },
  );

  const hasLoadedFullHistory = historyCursor === null;

  const updateTopBoundaryState = useCallback(() => {
    const scrollEl = scrollRef.current;

    if (!scrollEl) {
      hasReachedTopRef.current = false;
      return;
    }

    const isOverflowing = scrollEl.scrollHeight > scrollEl.clientHeight;
    const isNearTop = isOverflowing && scrollEl.scrollTop <= DEFAULT_TOP_TOLERANCE_PX;

    if (isNearTop && !hasReachedTopRef.current) {
      hasReachedTopRef.current = true;

      if (!hasLoadedFullHistory && !isLoadingHistory) {
        void loadMoreHistory();
      }

      return;
    }

    if (!isNearTop) {
      hasReachedTopRef.current = false;
    }
  }, [hasLoadedFullHistory, isLoadingHistory, loadMoreHistory]);

  useEffect(() => {
    hasReachedTopRef.current = false;
  }, [session.id]);

  useEffect(() => {
    const scrollEl = scrollRef.current;

    if (!scrollEl) {
      return;
    }

    updateTopBoundaryState();
    scrollEl.addEventListener("scroll", updateTopBoundaryState);

    return () => scrollEl.removeEventListener("scroll", updateTopBoundaryState);
  }, [session.id, updateTopBoundaryState]);

  useEffect(() => {
    if (isLoadingHistory || hasLoadedFullHistory) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const scrollEl = scrollRef.current;

      if (!scrollEl || scrollEl.scrollHeight > scrollEl.clientHeight + 1) {
        return;
      }

      void loadMoreHistory();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [hasLoadedFullHistory, isLoadingHistory, loadMoreHistory, messages.length, pendingPermissions.length, pendingQuestions.length, session.id]);

  useLayoutEffect(() => {
    const pendingBottomOffset = pendingPrependBottomOffsetRef.current;
    const scrollEl = scrollRef.current;

    if (pendingBottomOffset === null || !scrollEl) {
      return;
    }

    pendingPrependBottomOffsetRef.current = null;
    scrollEl.scrollTop = Math.max(scrollEl.scrollHeight - pendingBottomOffset, 0);
  }, [prependRevision]);

  const { revertedMessages, visibleMessages } = useMemo(
    () => partitionMessagesByRevert(messages, session.revert),
    [messages, session.revert],
  );
  const isBusy = status.type !== "idle";
  const isEmpty = visibleMessages.length === 0;
  const showCenteredEmptyState = isEmpty
    && !revertedMessages.length
    && pendingPermissions.length === 0
    && pendingQuestions.length === 0;
  const emptyStateMessage = revertedMessages.length
    ? "All visible messages are currently reverted."
    : "No messages have been recorded for this session yet.";

  return (
    <ScrollableLayout contentRef={contentRef} scrollRef={scrollRef}>
      <section className="flex min-h-full flex-1 flex-col gap-6 pr-1">
        {status.type === "retry" ? <p className="pt-4 text-sm leading-6">{statusDescription(status)}</p> : null}
        <section className={cn("space-y-0", showCenteredEmptyState && "flex flex-1 items-center justify-center px-4 text-center")}>
          {isLoadingHistory ? <p className="pt-4 text-sm leading-6">Loading earlier messages...</p> : null}
          {isEmpty ? <p className={cn("text-base leading-6", !showCenteredEmptyState && "pt-4")}>{emptyStateMessage}</p> : null}
          {visibleMessages.map((message) => (
            <MessageCard
              actionPath={actionPath}
              isSessionBusy={isBusy}
              key={message.info.id}
              message={message}
            />
          ))}
          {revertedMessages.length ? (
            <SessionRevertDock actionPath={actionPath} isSessionBusy={isBusy} messages={revertedMessages} />
          ) : null}
          <QuestionCard onReject={rejectQuestion} onReply={replyQuestion} questions={pendingQuestions} />
          <PermissionCard messages={visibleMessages} onReply={replyPermission} permissions={pendingPermissions} />
        </section>
      </section>
    </ScrollableLayout>
  );
}
