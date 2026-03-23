import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { data, Outlet, redirect, useLocation, useNavigate, useRevalidator, useSearchParams } from "react-router";

import { useInstanceEvents } from "~/components/events/instance-events-provider";
import { Breadcrumbs } from "~/components/shell/breadcrumbs";
import { ScrollableLayout } from "~/components/shell/scrollable-layout";
import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import {
  abortOpencodeSession,
  forkOpencodeSession,
  getOpencodeSession,
  getOpencodeSessionStatuses,
  listOpencodeAgents,
  listOpencodeMessages,
  listOpencodePermissionRequests,
  revertOpencodeSession,
  submitOpencodePrompt,
  unrevertOpencodeSession,
} from "~/lib/instances/opencode.server";
import { replyToOpencodePermissionRequest } from "~/lib/instances/opencode.client";
import { getInstanceOrThrow } from "~/lib/instances/runtime.server";
import { getUserMessageText } from "~/lib/opencode/message-helpers";
import {
  applyMessagePartDelta,
  mergeMessages,
  removeMessage,
  removeMessagePart,
  upsertMessage,
  upsertMessagePart,
} from "~/lib/opencode/message-state";
import type {
  OpencodeMessageWithParts,
  OpencodeAgent,
  OpencodePermissionRequest,
  OpencodeSessionInfo,
  OpencodeSessionStatus,
} from "~/lib/opencode/events";
import { getInitialAgent, getSelectableAgents } from "~/lib/opencode/agents";
import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleDefinition } from "~/lib/route-handle";
import { getNewSessionIconNavAction } from "~/routes/_app/instances.$instanceId/+/instance-route";
import { SessionComposer } from "~/routes/_app/instances.$instanceId/sessions.$sessionId/+/session-composer";

import { getSessionBreadcrumbs, getSessionIconNavActions, getSessionName, type SessionRouteContext } from "./+/session-route";

import type { Route } from "./+types/_layout";

export const handle: RouteHandleDefinition<Route.ComponentProps> = defineRouteHandle<Route.ComponentProps>({
  title: ({ data, params }) =>
    getSessionBreadcrumbs({
      instanceId: params.instanceId,
      instanceName: data?.instance?.name,
      session: data?.session,
      sessionId: params.sessionId,
    }),
  leadingIconAction: ({ params }) => {
    const instanceId = params.instanceId ?? "";

    return getNewSessionIconNavAction(instanceId);
  },
  iconNavActions: ({ params }) => {
    const instanceId = params.instanceId ?? "";
    const sessionId = params.sessionId ?? "";

    return getSessionIconNavActions(instanceId, sessionId);
  },
});

export async function loader({ params, request }: Route.LoaderArgs) {
  await requireAuthenticatedPasskey(request);

  const instanceId = params.instanceId;
  const sessionId = params.sessionId;
  const url = new URL(request.url);
  const shouldLoadFullHistory = url.searchParams.get("fullHistory") === "1";
  const instance = await getInstanceOrThrow(instanceId);
  const [messages, permissions, session, statuses, agents] = await Promise.all([
    listOpencodeMessages(instance, sessionId, shouldLoadFullHistory ? undefined : 50),
    listOpencodePermissionRequests(instance, sessionId),
    getOpencodeSession(instance, sessionId),
    getOpencodeSessionStatuses(instance),
    listOpencodeAgents(instance),
  ]);

  return {
    initialMessages: messages,
    initialPermissions: permissions,
    initialStatus: statuses[sessionId] ?? { type: "idle" },
    initialAgents: agents,
    loadedFullHistory: shouldLoadFullHistory || messages.length < 50,
    instance,
    session,
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  await requireAuthenticatedPasskey(request);

  const instanceId = params.instanceId;
  const sessionId = params.sessionId;
  const instance = await getInstanceOrThrow(instanceId);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "").trim();

  if (intent === "prompt") {
    const rawText = String(formData.get("text") ?? "");
    const text = rawText.trim();
    const files = formData
      .getAll("attachments")
      .filter((value): value is File => value instanceof File && value.size > 0 && value.type.startsWith("image/"));

    const attachments = await Promise.all(
      files.map(async (file) => ({
        type: "file" as const,
        filename: file.name || undefined,
        mime: file.type,
        url: `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`,
      })),
    );

    if (!text && attachments.length === 0) {
      return data({ error: "Enter a message before sending.", intent, ok: false }, { status: 400 });
    }

    const agent = String(formData.get("agent") ?? "").trim();
    const parts = [
      ...(text ? [{ type: "text" as const, text: rawText }] : []),
      ...attachments,
    ];

    await submitOpencodePrompt(instance, sessionId, {
      parts,
      ...(agent ? { agent } : {}),
    });

    return data({ error: null, intent, ok: true });
  }

  if (intent === "abort") {
    await abortOpencodeSession(instance, sessionId);
    return data({ error: null, intent, ok: true });
  }

  if (intent === "revert") {
    const messageId = String(formData.get("messageId") ?? "").trim();

    if (!messageId) {
      return data({ error: "Choose a message to undo from.", intent, ok: false }, { status: 400 });
    }

    await revertOpencodeSession(instance, sessionId, { messageId });
    return data({ error: null, intent, ok: true });
  }

  if (intent === "unrevert") {
    await unrevertOpencodeSession(instance, sessionId);
    return data({ error: null, intent, ok: true });
  }

  if (intent === "fork") {
    const messageId = String(formData.get("messageId") ?? "").trim();
    let prompt = "";

    if (messageId) {
      const messages = await listOpencodeMessages(instance, sessionId);
      const sourceMessage = messages.find((message) => message.info.id === messageId);
      prompt = sourceMessage ? getUserMessageText(sourceMessage) ?? "" : "";
    }

    const session = await forkOpencodeSession(instance, sessionId, { ...(messageId ? { messageId } : {}) });
    const searchParams = new URLSearchParams();

    if (prompt) {
      searchParams.set("prompt", prompt);
    }

    const search = searchParams.size ? `?${searchParams.toString()}` : "";
    return redirect(`/instances/${instanceId}/sessions/${session.id}${search}`);
  }

  return data({ error: "That action is not supported.", intent, ok: false }, { status: 400 });
}

export default function InstanceSessionLayoutRoute({ loaderData, matches }: Route.ComponentProps) {
  const { initialAgents, initialMessages, initialPermissions, initialStatus, instance, loadedFullHistory, session } = loaderData;
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const prefilledPrompt = searchParams.get("prompt") ?? "";
  const [messages, setMessages] = useState<OpencodeMessageWithParts[]>(initialMessages);
  const [hasLoadedFullHistory, setHasLoadedFullHistory] = useState(loadedFullHistory);
  const [pendingPermissions, setPendingPermissions] = useState<OpencodePermissionRequest[]>(initialPermissions);
  const [sessionState, setSessionState] = useState<OpencodeSessionInfo>(session);
  const [status, setStatus] = useState<OpencodeSessionStatus>(initialStatus);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const revalidator = useRevalidator();
  const sessionIdRef = useRef(session.id);
  const agents = useMemo<OpencodeAgent[]>(() => getSelectableAgents(initialAgents), [initialAgents]);
  const defaultAgent = useMemo<string | null>(() => getInitialAgent(initialMessages, initialAgents), [initialMessages, initialAgents]);
  const insertComposerReferenceEvents = useMemo(() => new EventTarget(), []);
  const insertComposerReference = useCallback((reference: string) => {
    insertComposerReferenceEvents.dispatchEvent(new CustomEvent("insert-reference", { detail: reference }));
  }, [insertComposerReferenceEvents]);
  const isLoadingFullHistory = searchParams.get("fullHistory") === "1" && !hasLoadedFullHistory;
  const isTranscriptRoute = location.pathname === `/instances/${instance.id}/sessions/${session.id}`;
  const eventTypes = useMemo(
    () => [
      "message.updated",
      "message.removed",
      "message.part.updated",
      "message.part.delta",
      "message.part.removed",
      "permission.asked",
      "permission.replied",
      "session.updated",
      "session.status",
      "session.error",
    ] as const,
    [],
  );

  useEffect(() => {
    if (sessionIdRef.current === session.id) {
      setMessages((current) => mergeMessages(current, initialMessages));
      setHasLoadedFullHistory((current) => current || loadedFullHistory);
      setStatus(initialStatus);
      setSessionState(session);
      setPendingPermissions(initialPermissions);
      return;
    }

    sessionIdRef.current = session.id;
    setMessages(initialMessages);
    setHasLoadedFullHistory(loadedFullHistory);
    setStatus(initialStatus);
    setSessionState(session);
    setPendingPermissions(initialPermissions);
  }, [initialMessages, initialPermissions, initialStatus, loadedFullHistory, session]);

  const replyPermission = useCallback(
    async (requestId: string, reply: "once" | "always" | "reject") => {
      const nextPermissions = pendingPermissions.filter((permission) => permission.id !== requestId);
      setPendingPermissions(nextPermissions);

      try {
        await replyToOpencodePermissionRequest(instance.id, requestId, reply);
      } catch {
        revalidator.revalidate();
      }
    },
    [instance.id, pendingPermissions, revalidator],
  );

  useInstanceEvents(
    (event) => {
      switch (event.type) {
        case "session.status": {
          setStatus(event.properties.status);
          return;
        }

        case "session.updated": {
          setSessionState(event.properties.info);
          return;
        }

        case "session.error": {
          setSessionError(event.properties.error.message ?? event.properties.error.name);
          return;
        }

        case "message.updated": {
          setMessages((current) => upsertMessage(current, event.properties.info));
          return;
        }

        case "message.removed": {
          setMessages((current) => removeMessage(current, event.properties.messageID));
          return;
        }

        case "message.part.updated": {
          setMessages((current) => upsertMessagePart(current, event.properties.part));
          return;
        }

        case "message.part.delta": {
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
          setMessages((current) =>
            removeMessagePart(current, event.properties.messageID, event.properties.partID),
          );
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

        default:
          return;
      }
    },
    { instanceId: instance.id, sessionId: session.id, types: eventTypes },
  );

  const isBusy = status.type !== "idle";
  const loadFullHistory = useCallback(() => {
    if (hasLoadedFullHistory || isLoadingFullHistory) {
      return;
    }

    const nextSearchParams = new URLSearchParams(location.search);
    nextSearchParams.set("fullHistory", "1");

    navigate(
      {
        pathname: location.pathname,
        search: `?${nextSearchParams.toString()}`,
      },
      { preventScrollReset: true, replace: true },
    );
  }, [hasLoadedFullHistory, isLoadingFullHistory, location.pathname, location.search, navigate]);

  return (
    <>
      <Breadcrumbs depth={matches.length}>
        <Breadcrumbs.Item to={`/instances/${instance.id}`}>{instance.name}</Breadcrumbs.Item>
        <Breadcrumbs.Item to={`/instances/${instance.id}/sessions/${session.id}`}>
          {getSessionName(sessionState)}
        </Breadcrumbs.Item>
      </Breadcrumbs>
      <ScrollableLayout
        onReachTop={isTranscriptRoute ? loadFullHistory : undefined}
        stickToBottom
        footer={
          <SessionComposer
            agents={agents.map((agent) => agent.name)}
            defaultAgent={defaultAgent}
            insertReferenceEvents={insertComposerReferenceEvents}
            isBusy={isBusy}
            onClearSessionError={() => setSessionError(null)}
            prefilledPrompt={prefilledPrompt}
            sessionError={sessionError}
            sessionId={session.id}
          />
        }
      >
        <Outlet
          context={{
            hasLoadedFullHistory,
            instance,
            isLoadingFullHistory,
            insertComposerReference,
            loadFullHistory,
            messages,
            pendingPermissions,
            replyPermission,
            session: sessionState,
            sessionError,
            status,
          } satisfies SessionRouteContext}
        />
      </ScrollableLayout>
    </>
  );
}
