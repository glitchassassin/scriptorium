import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router";
import { Icon } from "@iconify/react";

import { getDocumentTitle } from "~/lib/document-title";
import { useMarkSessionReadOptimistic, useSession, useUnreadStatusEvents } from "~/store/sessions-provider";
import { useSessionInfo, useSessionStatus } from "~/routes/_app/projects.$projectId/sessions.$sessionId/+/session-live";
import { SessionTranscript } from "~/routes/_app/projects.$projectId/sessions.$sessionId/+/session-transcript";

import type { Route } from "./+types/index";
import { getSessionName, type SessionRouteContext } from "./+/session-route";

export default function ProjectSessionTranscriptRoute() {
  const { actionPath, project, parentSession, transcriptInitialState } = useOutletContext<SessionRouteContext>();
  const session = useSessionInfo();
  const status = useSessionStatus();
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
    { projectId: project.id, sessionId: session.id },
  );

  useEffect(() => {
    if (!canAck || !needsAck) {
      return;
    }

    submitAck(updatedAt);
  }, [canAck, needsAck, submitAck, updatedAt]);

  return (
    <>
      <title>{getDocumentTitle(getSessionName(session), project.name)}</title>
      {parentSession ? (
        <div className="border-b-2 border-black px-3">
          <Link
            className="inline-flex min-h-11 items-center gap-1 text-base font-bold underline underline-offset-4"
            to={`/projects/${project.id}/sessions/${parentSession.id}`}
          >
            <Icon className="size-5" icon="mdi:arrow-left" />
            <span>{parentSession.title?.trim() || parentSession.id.slice(0, 12)}</span>
          </Link>
        </div>
      ) : null}
      <SessionTranscript
        actionPath={actionPath}
        initialHistoryCursor={transcriptInitialState.initialHistoryCursor}
        initialMessages={transcriptInitialState.initialMessages}
        initialPermissions={transcriptInitialState.initialPermissions}
        initialQuestions={transcriptInitialState.initialQuestions}
        projectId={project.id}
        session={session}
        status={status}
      />
    </>
  );
}
