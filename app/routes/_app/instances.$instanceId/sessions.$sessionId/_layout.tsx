import { useCallback, useMemo } from "react";
import { data, Outlet, redirect, useSearchParams } from "react-router";

import { Breadcrumbs } from "~/components/shell/breadcrumbs";
import { ScrollableLayout } from "~/components/shell/scrollable-layout";
import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import {
  abortOpencodeSession,
  forkOpencodeSession,
  getOpencodeSession,
  getOpencodeSessionStatuses,
  getOpencodeProviderCatalog,
  listOpencodeAgents,
  listOpencodeCommands,
  listOpencodeMessagePage,
  listOpencodeMessages,
  listOpencodePermissionRequests,
  listOpencodeQuestionRequests,
  revertOpencodeSession,
  submitOpencodeCommand,
  submitOpencodePrompt,
  unrevertOpencodeSession,
} from "~/lib/instances/opencode.server";
import { parseSlashCommand } from "~/lib/opencode/commands";
import { getInstanceOrThrow } from "~/lib/instances/runtime.server";
import { getUserMessageText } from "~/lib/opencode/message-helpers";
import type {
  OpencodeAgent,
  OpencodeCommandInfo,
  OpencodeModelRef,
  OpencodeProvider,
} from "~/lib/opencode/events";
import { getInitialAgent, getSelectableAgents } from "~/lib/opencode/agents";
import { getInitialSessionModel, getInitialSessionVariant } from "~/lib/opencode/models";
import { defineRouteHandle } from "~/lib/route-handle";
import type { RouteHandleDefinition } from "~/lib/route-handle";
import { getServerTimingHeaders, makeTimings, time } from "~/lib/server-timing.server";
import { getNewSessionIconNavAction } from "~/routes/_app/instances.$instanceId/+/instance-route";
import { SessionComposer } from "~/routes/_app/instances.$instanceId/sessions.$sessionId/+/session-composer";
import {
  SessionLiveProvider,
  useSessionErrorState,
  useSessionInfo,
  useSessionStatus,
} from "~/routes/_app/instances.$instanceId/sessions.$sessionId/+/session-live";

import { getSessionBreadcrumbs, getSessionIconNavActions, getSessionName, type SessionRouteContext } from "./+/session-route";

import type { Route } from "./+types/_layout";

import { SESSION_MESSAGE_PAGE_SIZE } from "~/lib/opencode/message-page";

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
  const timings = makeTimings("session loader");

  await time(() => requireAuthenticatedPasskey(request), {
    desc: "require authenticated passkey",
    timings,
    type: "auth",
  });

  const instanceId = params.instanceId;
  const sessionId = params.sessionId;
  const instance = await time(() => getInstanceOrThrow(instanceId), {
    desc: "get instance",
    timings,
    type: "instance",
  });
  const [messagePage, permissions, questions, session, statuses, agents, commands, providerCatalog] = await Promise.all([
    time(() => listOpencodeMessagePage(instance, sessionId, { limit: SESSION_MESSAGE_PAGE_SIZE }), {
      desc: "list recent session history",
      timings,
      type: "messages",
    }),
    time(() => listOpencodePermissionRequests(instance, sessionId), {
      desc: "list permission requests",
      timings,
      type: "permissions",
    }),
    time(() => listOpencodeQuestionRequests(instance, sessionId), {
      desc: "list question requests",
      timings,
      type: "questions",
    }),
    time(() => getOpencodeSession(instance, sessionId), {
      desc: "get session",
      timings,
      type: "session",
    }),
    time(() => getOpencodeSessionStatuses(instance), {
      desc: "get session statuses",
      timings,
      type: "statuses",
    }),
    time(() => listOpencodeAgents(instance), {
      desc: "list agents",
      timings,
      type: "agents",
    }),
    time(() => listOpencodeCommands(instance), {
      desc: "list commands",
      timings,
      type: "commands",
    }),
    time(() => getOpencodeProviderCatalog(instance), {
      desc: "get provider catalog",
      timings,
      type: "providers",
    }),
  ]);

  return data(
      {
        initialHistoryCursor: messagePage.nextCursor,
        initialMessages: messagePage.items,
        initialPermissions: permissions,
        initialQuestions: questions,
        initialStatus: statuses[sessionId] ?? { type: "idle" },
        initialAgents: agents,
        initialCommands: commands,
        initialProviderDefaults: providerCatalog.default,
        initialProviders: providerCatalog.providers,
        instance,
        session,
      },
    {
      headers: {
        "Server-Timing": timings.toString(),
      },
    },
  );
}

export function headers(args: Route.HeadersArgs) {
  return getServerTimingHeaders(args);
}

export async function action({ params, request }: Route.ActionArgs) {
  await requireAuthenticatedPasskey(request);

  const instanceId = params.instanceId;
  const sessionId = params.sessionId;
  const instance = await getInstanceOrThrow(instanceId);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "").trim();
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
  const agent = String(formData.get("agent") ?? "").trim();
  const modelProviderID = String(formData.get("modelProviderID") ?? "").trim();
  const modelID = String(formData.get("modelID") ?? "").trim();
  const variant = String(formData.get("variant") ?? "").trim();
  const model: OpencodeModelRef | null = modelProviderID && modelID ? { modelID, providerID: modelProviderID } : null;

  async function submitCommand(input: { arguments: string; command: string; clearDraft: boolean }) {
    await submitOpencodeCommand(instance, sessionId, {
      arguments: input.arguments,
      command: input.command,
      ...(attachments.length ? { parts: attachments } : {}),
      ...(agent ? { agent } : {}),
      ...(model ? { model: `${model.providerID}/${model.modelID}` } : {}),
      ...(variant ? { variant } : {}),
    });

    return data({ clearDraft: input.clearDraft, error: null, intent: "command", ok: true });
  }

  if (intent === "prompt") {
    const rawText = String(formData.get("text") ?? "");
    const text = rawText.trim();
    const commandNames = (await listOpencodeCommands(instance)).map((item) => item.name);
    const command = parseSlashCommand(rawText, commandNames);

    if (command) {
      return submitCommand({ ...command, clearDraft: true });
    }

    if (!text && attachments.length === 0) {
      return data({ error: "Enter a message before sending.", intent, ok: false }, { status: 400 });
    }
    const parts = [
      ...(text ? [{ type: "text" as const, text: rawText }] : []),
      ...attachments,
    ];

    await submitOpencodePrompt(instance, sessionId, {
      parts,
      ...(agent ? { agent } : {}),
      ...(model ? { model } : {}),
      ...(variant ? { variant } : {}),
    });

    return data({ clearDraft: true, error: null, intent, ok: true });
  }

  if (intent === "command") {
    const command = String(formData.get("command") ?? "").trim();

    if (!command) {
      return data({ error: "Choose a command before sending.", intent, ok: false }, { status: 400 });
    }

    return submitCommand({
      arguments: String(formData.get("arguments") ?? ""),
      clearDraft: String(formData.get("clearDraft") ?? "") === "1",
      command,
    });
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

type SessionComposerFooterProps = {
  agents: string[];
  commands: OpencodeCommandInfo[];
  defaultAgent: string | null;
  defaultModel: OpencodeModelRef | null;
  defaultVariant: string | null;
  insertReferenceEvents: EventTarget;
  prefilledPrompt: string;
  providers: OpencodeProvider[];
  sessionId: string;
};

function SessionLayoutBreadcrumbs({
  instanceId,
  instanceName,
  matches,
  sessionId,
}: {
  instanceId: string;
  instanceName: string;
  matches: Route.ComponentProps["matches"];
  sessionId: string;
}) {
  const session = useSessionInfo();

  return (
    <Breadcrumbs depth={matches.length}>
      <Breadcrumbs.Item to={`/instances/${instanceId}`}>{instanceName}</Breadcrumbs.Item>
      <Breadcrumbs.Item to={`/instances/${instanceId}/sessions/${sessionId}`}>
        {getSessionName(session)}
      </Breadcrumbs.Item>
    </Breadcrumbs>
  );
}

function SessionComposerFooter({
  agents,
  commands,
  defaultAgent,
  defaultModel,
  defaultVariant,
  insertReferenceEvents,
  prefilledPrompt,
  providers,
  sessionId,
}: SessionComposerFooterProps) {
  const status = useSessionStatus();
  const { clearSessionError, sessionError } = useSessionErrorState();

  return (
    <SessionComposer
      agents={agents}
      commands={commands}
      defaultAgent={defaultAgent}
      defaultModel={defaultModel}
      defaultVariant={defaultVariant}
      insertReferenceEvents={insertReferenceEvents}
      isBusy={status.type !== "idle"}
      onClearSessionError={clearSessionError}
      prefilledPrompt={prefilledPrompt}
      providers={providers}
      sessionError={sessionError}
      sessionId={sessionId}
    />
  );
}

export default function InstanceSessionLayoutRoute({ loaderData, matches }: Route.ComponentProps) {
  const {
    initialAgents,
    initialCommands,
    initialHistoryCursor,
    initialMessages,
    initialPermissions,
    initialQuestions,
    initialProviderDefaults,
    initialProviders,
    initialStatus,
    instance,
    session,
  } = loaderData;
  const [searchParams] = useSearchParams();
  const prefilledPrompt = searchParams.get("prompt") ?? "";
  const agents = useMemo<OpencodeAgent[]>(() => getSelectableAgents(initialAgents), [initialAgents]);
  const commands = useMemo<OpencodeCommandInfo[]>(() => initialCommands, [initialCommands]);
  const providers = useMemo<OpencodeProvider[]>(() => initialProviders, [initialProviders]);
  const defaultAgent = useMemo<string | null>(() => getInitialAgent(initialMessages, initialAgents), [initialMessages, initialAgents]);
  const defaultModel = useMemo<OpencodeModelRef | null>(
    () => getInitialSessionModel(initialMessages, { default: initialProviderDefaults, providers: initialProviders }),
    [initialMessages, initialProviderDefaults, initialProviders],
  );
  const defaultVariant = useMemo(
    () => getInitialSessionVariant(initialMessages, defaultModel, initialProviders),
    [defaultModel, initialMessages, initialProviders],
  );
  const insertComposerReferenceEvents = useMemo(() => new EventTarget(), []);
  const insertComposerReference = useCallback((reference: string) => {
    insertComposerReferenceEvents.dispatchEvent(new CustomEvent("insert-reference", { detail: reference }));
  }, [insertComposerReferenceEvents]);

  const outletContext = useMemo<SessionRouteContext>(() => ({
    actionPath: `/instances/${instance.id}/sessions/${session.id}`,
    instance,
    insertComposerReference,
    sessionId: session.id,
    transcriptInitialState: {
      initialHistoryCursor,
      initialMessages,
      initialPermissions,
      initialQuestions,
    },
  }), [initialHistoryCursor, initialMessages, initialPermissions, initialQuestions, insertComposerReference, instance, session.id]);

  return (
    <SessionLiveProvider
      initialSession={session}
      initialStatus={initialStatus}
      instanceId={instance.id}
    >
      <SessionLayoutBreadcrumbs
        instanceId={instance.id}
        instanceName={instance.name}
        matches={matches}
        sessionId={session.id}
      />
      <ScrollableLayout
        footer={
          <SessionComposerFooter
            agents={agents.map((agent) => agent.name)}
            commands={commands}
            defaultAgent={defaultAgent}
            defaultModel={defaultModel}
            defaultVariant={defaultVariant}
            insertReferenceEvents={insertComposerReferenceEvents}
            prefilledPrompt={prefilledPrompt}
            providers={providers}
            sessionId={session.id}
          />
        }
      >
        <Outlet context={outletContext} />
      </ScrollableLayout>
    </SessionLiveProvider>
  );
}
