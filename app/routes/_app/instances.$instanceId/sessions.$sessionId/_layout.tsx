import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { data, Outlet, useFetcher, useRevalidator } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import { useInstanceEvents } from "~/components/events/instance-events-provider";
import { ScrollableLayout } from "~/components/shell/scrollable-layout";
import { PopupPicker } from "~/components/ui/popup-picker";
import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import {
  abortOpencodeSession,
  getOpencodeSession,
  getOpencodeSessionStatuses,
  listOpencodeAgents,
  listOpencodeMessages,
  listOpencodePermissionRequests,
  submitOpencodePrompt,
} from "~/lib/instances/opencode.server";
import { replyToOpencodePermissionRequest } from "~/lib/instances/opencode.client";
import { getInstanceOrThrow } from "~/lib/instances/runtime.server";
import {
  applyMessagePartDelta,
  removeMessage,
  removeMessagePart,
  upsertMessage,
  upsertMessagePart,
} from "~/lib/opencode/message-state";
import type {
  OpencodeMessageWithParts,
  OpencodeAgent,
  OpencodePermissionRequest,
  OpencodeSessionStatus,
} from "~/lib/opencode/events";
import { getInitialAgent, getSelectableAgents } from "~/lib/opencode/agents";
import type { RouteHandle } from "~/lib/route-handle";

import { getSessionIconNavActions, sessionRouteTitle, type SessionRouteContext } from "./+/session-route";

import type { Route } from "./+types/_layout";

export const handle = {
  title: ({ data }: { data?: unknown }) => sessionRouteTitle(data),
  iconNavActions: ({ params }: { params: Record<string, string | undefined> }) => {
    const instanceId = params["instanceId"] ?? "";
    const sessionId = params["sessionId"] ?? "";

    return getSessionIconNavActions(instanceId, sessionId);
  },
} satisfies RouteHandle;

export async function loader({ params, request }: Route.LoaderArgs) {
  await requireAuthenticatedPasskey(request);

  const instanceId = params.instanceId;
  const sessionId = params.sessionId;
  const instance = await getInstanceOrThrow(instanceId);
  const [messages, permissions, session, statuses, agents] = await Promise.all([
    listOpencodeMessages(instance, sessionId, 50),
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
    const text = String(formData.get("text") ?? "").trim();

    if (!text) {
      return data({ error: "Enter a message before sending.", intent, ok: false }, { status: 400 });
    }

    const agent = String(formData.get("agent") ?? "").trim();

    await submitOpencodePrompt(instance, sessionId, {
      text,
      ...(agent ? { agent } : {}),
    });

    return data({ error: null, intent, ok: true });
  }

  if (intent === "abort") {
    await abortOpencodeSession(instance, sessionId);
    return data({ error: null, intent, ok: true });
  }

  return data({ error: "That action is not supported.", intent, ok: false }, { status: 400 });
}

export default function InstanceSessionLayoutRoute({ loaderData }: Route.ComponentProps) {
  const { initialAgents, initialMessages, initialPermissions, initialStatus, instance, session } = loaderData;
  const [composerText, setComposerText] = useState("");
  const [messages, setMessages] = useState<OpencodeMessageWithParts[]>(initialMessages);
  const [pendingPermissions, setPendingPermissions] = useState<OpencodePermissionRequest[]>(initialPermissions);
  const [status, setStatus] = useState<OpencodeSessionStatus>(initialStatus);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const promptFetcher = useFetcher<typeof action>();
  const abortFetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const composerFormRef = useRef<HTMLFormElement>(null);
  const agents = useMemo<OpencodeAgent[]>(() => getSelectableAgents(initialAgents), [initialAgents]);
  const defaultAgent = useMemo<string | null>(() => getInitialAgent(initialMessages, initialAgents), [initialMessages, initialAgents]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(defaultAgent);
  const eventTypes = useMemo(
    () => [
      "message.updated",
      "message.removed",
      "message.part.updated",
      "message.part.delta",
      "message.part.removed",
      "permission.asked",
      "permission.replied",
      "session.status",
      "session.error",
    ] as const,
    [],
  );

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages, session.id]);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus, session.id]);

  useEffect(() => {
    setPendingPermissions(initialPermissions);
  }, [initialPermissions, session.id]);

  useEffect(() => {
    if (promptFetcher.data?.ok && promptFetcher.data.intent === "prompt") {
      setComposerText("");
      setSessionError(null);
    }
  }, [promptFetcher.data]);

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

  useEffect(() => {
    setSelectedAgent(defaultAgent);
  }, [defaultAgent, session.id]);

  useInstanceEvents(
    (event) => {
      switch (event.type) {
        case "session.status": {
          setStatus(event.properties.status);
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

  const promptError = promptFetcher.data?.intent === "prompt" ? promptFetcher.data.error : null;
  const abortError = abortFetcher.data?.intent === "abort" ? abortFetcher.data.error : null;
  const isPromptPending = promptFetcher.state !== "idle";
  const isAbortPending = abortFetcher.state !== "idle";
  const isBusy = status.type !== "idle";

  return (
    <ScrollableLayout
      stickToBottom
      footer={
        <div className="border-t-2 border-black px-6 py-4 sm:px-8">
          <div className="space-y-3">
            {promptError ? <p className="text-base leading-6">{promptError}</p> : null}
            {abortError ? <p className="text-base leading-6">{abortError}</p> : null}
            {sessionError ? <p className="text-base leading-6">{sessionError}</p> : null}
            <div className="flex items-stretch gap-2">
              <div className="min-w-0 flex-1">
                <promptFetcher.Form className="min-w-0 flex-1" method="post" ref={composerFormRef}>
                  <input name="intent" type="hidden" value="prompt" />
                  <input name="agent" type="hidden" value={selectedAgent ?? ""} />
                  <textarea
                    className="min-h-32 w-full px-3 py-2 text-base leading-7"
                    name="text"
                    onChange={(event) => setComposerText(event.currentTarget.value)}
                    placeholder="Send a message to this session"
                    value={composerText}
                  />
                </promptFetcher.Form>
              </div>
              <div className="flex shrink-0 self-stretch flex-col items-stretch justify-between gap-1">
                <PopupPicker
                  ariaLabel="Choose agent"
                  emptyLabel="Select agent"
                  onSelect={setSelectedAgent}
                  options={agents.map((agent) => ({ value: agent.name, label: agent.name }))}
                  selectedValue={selectedAgent}
                />
                <div className="flex items-end gap-2">
                  <abortFetcher.Form method="post">
                    <input name="intent" type="hidden" value="abort" />
                    <button
                      aria-label="Stop current response"
                      className="inline-flex min-h-11 min-w-11 items-center justify-center disabled:opacity-25"
                      disabled={isAbortPending || !isBusy}
                      type="submit"
                    >
                      <Icon className="size-6" icon="mdi:stop-circle" />
                    </button>
                  </abortFetcher.Form>
                  <button
                    aria-label="Send message"
                    className="inline-flex min-h-11 min-w-11 items-center justify-center bg-black text-white disabled:opacity-25"
                    disabled={isPromptPending}
                    onClick={() => composerFormRef.current?.requestSubmit()}
                    type="button"
                  >
                    <Icon className="size-6" icon="mdi:send" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <Outlet
        context={{
          instance,
          messages,
          pendingPermissions,
          replyPermission,
          session,
          sessionError,
          status,
        } satisfies SessionRouteContext}
      />
    </ScrollableLayout>
  );
}
