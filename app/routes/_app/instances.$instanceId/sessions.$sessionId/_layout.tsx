import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { data, Outlet, redirect, useFetcher, useLocation, useNavigate, useRevalidator, useSearchParams } from "react-router";
import { Icon } from "@iconify/react";
import "@iconify-json/mdi";

import { useInstanceEvents } from "~/components/events/instance-events-provider";
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
import { getInitialAgent, getNextAgent, getSelectableAgents } from "~/lib/opencode/agents";
import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleDefinition } from "~/lib/route-handle";
import safeArea from "~/styles/safe-area.module.css";
import { getNewSessionIconNavAction } from "~/routes/_app/instances.$instanceId/+/instance-route";

import { getSessionBreadcrumbs, getSessionIconNavActions, type SessionRouteContext } from "./+/session-route";

import type { Route } from "./+types/_layout";

type DraftImage = {
  id: string;
  file: File;
  preview: string;
};

function isImage(file: File) {
  return file.type.startsWith("image/");
}

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

export default function InstanceSessionLayoutRoute({ loaderData }: Route.ComponentProps) {
  const { initialAgents, initialMessages, initialPermissions, initialStatus, instance, loadedFullHistory, session } = loaderData;
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const prefilledPrompt = searchParams.get("prompt") ?? "";
  const [composerText, setComposerText] = useState("");
  const [messages, setMessages] = useState<OpencodeMessageWithParts[]>(initialMessages);
  const [hasLoadedFullHistory, setHasLoadedFullHistory] = useState(loadedFullHistory);
  const [pendingPermissions, setPendingPermissions] = useState<OpencodePermissionRequest[]>(initialPermissions);
  const [sessionState, setSessionState] = useState<OpencodeSessionInfo>(session);
  const [status, setStatus] = useState<OpencodeSessionStatus>(initialStatus);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const promptFetcher = useFetcher<typeof action>();
  const abortFetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const sessionIdRef = useRef(session.id);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const composerSelectionRef = useRef({ start: 0, end: 0 });
  const imageIdRef = useRef(0);
  const imagesRef = useRef<DraftImage[]>([]);
  const agents = useMemo<OpencodeAgent[]>(() => getSelectableAgents(initialAgents), [initialAgents]);
  const defaultAgent = useMemo<string | null>(() => getInitialAgent(initialMessages, initialAgents), [initialMessages, initialAgents]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(defaultAgent);
  const [images, setImages] = useState<DraftImage[]>([]);
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
      return;
    }

    sessionIdRef.current = session.id;
    setMessages(initialMessages);
    setHasLoadedFullHistory(loadedFullHistory);
    setStatus(initialStatus);
    setSessionState(session);
    setPendingPermissions(initialPermissions);
  }, [initialMessages, initialPermissions, initialStatus, loadedFullHistory, session]);

  useEffect(() => {
    setComposerText(prefilledPrompt);
    const caret = prefilledPrompt.length;
    composerSelectionRef.current = { start: caret, end: caret }; 
  }, [prefilledPrompt, session.id]);

  useEffect(() => {
    if (promptFetcher.data?.ok && promptFetcher.data.intent === "prompt") {
      setComposerText("");
      setImages((current) => {
        current.forEach((image) => URL.revokeObjectURL(image.preview));
        return [];
      });
      setSessionError(null);
      composerSelectionRef.current = { start: 0, end: 0 };
    }
  }, [promptFetcher.data]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(
    () => () => {
      imagesRef.current.forEach((image) => URL.revokeObjectURL(image.preview));
    },
    [],
  );

  const updateComposerSelection = useCallback((target?: HTMLTextAreaElement | null) => {
    const input = target ?? composerInputRef.current;

    if (!input) {
      return;
    }

    composerSelectionRef.current = {
      start: input.selectionStart ?? 0,
      end: input.selectionEnd ?? input.selectionStart ?? 0,
    };
  }, []);

  const insertComposerReference = useCallback((reference: string) => {
    let nextSelectionStart = 0;
    let nextSelectionEnd = 0;

    setComposerText((current) => {
      const maxIndex = current.length;
      const rawStart = composerSelectionRef.current.start;
      const rawEnd = composerSelectionRef.current.end;
      const start = Math.max(0, Math.min(rawStart, maxIndex));
      const end = Math.max(start, Math.min(rawEnd, maxIndex));
      const prefix = start > 0 && /\S/.test(current[start - 1] ?? "") ? " " : "";
      const suffix = end === current.length || /\S/.test(current[end] ?? "") ? " " : "";
      const insertion = `${prefix}${reference}${suffix}`;
      const next = `${current.slice(0, start)}${insertion}${current.slice(end)}`;
      const caret = start + insertion.length;

      nextSelectionStart = caret;
      nextSelectionEnd = caret;
      composerSelectionRef.current = { start: caret, end: caret };
      return next;
    });

    window.requestAnimationFrame(() => {
      const input = composerInputRef.current;

      if (!input) {
        return;
      }

      input.focus();
      input.setSelectionRange(nextSelectionStart, nextSelectionEnd);
      composerSelectionRef.current = { start: nextSelectionStart, end: nextSelectionEnd };
    });
  }, []);

  const addImages = useCallback(async (items: FileList | File[]) => {
    const files = Array.from(items).filter(isImage);

    if (files.length === 0) {
      return;
    }

    const next = await Promise.all(
      files.map(async (file) => ({
        id: `image-${imageIdRef.current++}`,
        file,
        preview: URL.createObjectURL(file),
      })),
    );

    setImages((current) => [...current, ...next]);
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages((current) => {
      const match = current.find((image) => image.id === id);

      if (match) {
        URL.revokeObjectURL(match.preview);
      }

      return current.filter((image) => image.id !== id);
    });
  }, []);

  const cycleAgent = useCallback(() => {
    setSelectedAgent((current) => getNextAgent(current, agents));
  }, [agents]);

  const submitPrompt = useCallback(() => {
    const formData = new FormData();
    formData.set("intent", "prompt");
    formData.set("agent", selectedAgent ?? "");
    formData.set("text", composerText);
    images.forEach((image) => formData.append("attachments", image.file, image.file.name));
    promptFetcher.submit(formData, { method: "post", encType: "multipart/form-data" });
  }, [composerText, images, promptFetcher, selectedAgent]);

  useEffect(() => {
    if (!prefilledPrompt) {
      return;
    }

    window.requestAnimationFrame(() => {
      const input = composerInputRef.current;

      if (!input) {
        return;
      }

      const caret = prefilledPrompt.length;
      input.focus();
      input.setSelectionRange(caret, caret);
      composerSelectionRef.current = { start: caret, end: caret };
    });
  }, [prefilledPrompt]);

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

  const promptError = promptFetcher.data?.intent === "prompt" ? promptFetcher.data.error : null;
  const abortError = abortFetcher.data?.intent === "abort" ? abortFetcher.data.error : null;
  const isPromptPending = promptFetcher.state !== "idle";
  const isAbortPending = abortFetcher.state !== "idle";
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
    <ScrollableLayout
      onReachTop={isTranscriptRoute ? loadFullHistory : undefined}
      stickToBottom
      footer={
        <div className={`${safeArea.footerPad4} border-t-2 border-black px-6 pt-4 sm:px-8`}>
          <div className="space-y-3">
            {promptError ? <p className="text-base leading-6">{promptError}</p> : null}
            {abortError ? <p className="text-base leading-6">{abortError}</p> : null}
            {sessionError ? <p className="text-base leading-6">{sessionError}</p> : null}
            <div className="flex items-stretch gap-2">
              <div className="min-w-0 flex-1">
                <promptFetcher.Form className="min-w-0 flex-1" method="post" onSubmit={(event) => event.preventDefault()}>
                  <input name="intent" type="hidden" value="prompt" />
                  <input name="agent" type="hidden" value={selectedAgent ?? ""} />
                  <input
                    accept="image/*"
                    className="hidden"
                    multiple
                    onChange={(event) => {
                      if (event.currentTarget.files) {
                        void addImages(event.currentTarget.files);
                      }

                      event.currentTarget.value = "";
                    }}
                    ref={imageInputRef}
                    type="file"
                  />
                  {images.length ? (
                    <div className="flex flex-wrap gap-2 border-b-2 border-black px-3 py-3">
                      {images.map((image) => (
                        <div key={image.id} className="relative size-20 overflow-hidden border-2 border-black bg-white">
                          <img alt={image.file.name} className="size-full object-cover" src={image.preview} />
                          <button
                            aria-label={`Remove ${image.file.name}`}
                            className="absolute right-1 top-1 inline-flex size-6 items-center justify-center border-2 border-black bg-white"
                            onClick={() => removeImage(image.id)}
                            type="button"
                          >
                            <Icon className="size-4" icon="mdi:close" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <textarea
                    className="min-h-32 w-full px-3 py-2 text-base leading-7"
                    name="text"
                    onBlur={(event) => updateComposerSelection(event.currentTarget)}
                    onChange={(event) => {
                      setComposerText(event.currentTarget.value);
                      updateComposerSelection(event.currentTarget);
                    }}
                    onClick={(event) => updateComposerSelection(event.currentTarget)}
                    onKeyUp={(event) => updateComposerSelection(event.currentTarget)}
                    onPaste={(event) => {
                      const files = Array.from(event.clipboardData.files ?? []).filter(isImage);

                      if (files.length === 0) {
                        return;
                      }

                      event.preventDefault();
                      void addImages(files);
                    }}
                    onDragOver={(event) => {
                      if (Array.from(event.dataTransfer?.files ?? []).some(isImage)) {
                        event.preventDefault();
                      }
                    }}
                    onDrop={(event) => {
                      const files = Array.from(event.dataTransfer.files ?? []).filter(isImage);

                      if (files.length === 0) {
                        return;
                      }

                      event.preventDefault();
                      void addImages(files);
                    }}
                    onSelect={(event) => updateComposerSelection(event.currentTarget)}
                    placeholder="Send a message, paste an image, or attach one"
                    ref={composerInputRef}
                    value={composerText}
                  />
                </promptFetcher.Form>
              </div>
              <div className="flex shrink-0 self-stretch flex-col items-stretch justify-between gap-1">
                <button
                  aria-label="Cycle agent"
                  className="min-h-11 bg-white px-3 py-2 text-left text-sm leading-5 disabled:opacity-25"
                  disabled={!agents.length}
                  onClick={cycleAgent}
                  onPointerDown={(event) => event.preventDefault()}
                  type="button"
                >
                  {selectedAgent ?? "No agent"}
                </button>
                <div className="flex items-end gap-2">
                  <button
                    aria-label="Attach image"
                    className="inline-flex min-h-11 min-w-11 items-center justify-center bg-white disabled:opacity-25"
                    disabled={isPromptPending}
                    onClick={() => imageInputRef.current?.click()}
                    type="button"
                  >
                    <Icon className="size-6" icon="mdi:image-plus" />
                  </button>
                  <abortFetcher.Form method="post">
                    <input name="intent" type="hidden" value="abort" />
                    <button
                      aria-label="Stop current response"
                      className="inline-flex min-h-11 min-w-11 items-center justify-center disabled:opacity-25"
                      disabled={isAbortPending || !isBusy}
                      onPointerDown={(event) => event.preventDefault()}
                      type="submit"
                    >
                      <Icon className="size-6" icon="mdi:stop-circle" />
                    </button>
                  </abortFetcher.Form>
                  <button
                    aria-label="Send message"
                    className="inline-flex min-h-11 min-w-11 items-center justify-center bg-black text-white disabled:opacity-25"
                    disabled={isPromptPending}
                    onClick={submitPrompt}
                    onPointerDown={(event) => event.preventDefault()}
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
  );
}
