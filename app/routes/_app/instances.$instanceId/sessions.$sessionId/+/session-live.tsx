import {
  type Context,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRevalidator } from "react-router";

import { useInstanceEvents } from "~/components/events/instance-events-provider";
import { replyToOpencodePermissionRequest } from "~/lib/instances/opencode.client";
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
  OpencodePermissionRequest,
  OpencodeSessionInfo,
  OpencodeSessionStatus,
} from "~/lib/opencode/events";

const SESSION_EVENT_TYPES = [
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
] as const;

type SessionPermissionsContextValue = {
  pendingPermissions: OpencodePermissionRequest[];
  replyPermission: (requestId: string, reply: "once" | "always" | "reject") => Promise<void>;
};

type SessionErrorContextValue = {
  clearSessionError: () => void;
  sessionError: string | null;
};

type SessionLiveProviderProps = {
  children: ReactNode;
  initialMessages: OpencodeMessageWithParts[];
  initialPermissions: OpencodePermissionRequest[];
  initialSession: OpencodeSessionInfo;
  initialStatus: OpencodeSessionStatus;
  instanceId: string;
  loadedFullHistory: boolean;
};

const SessionMessagesContext = createContext<OpencodeMessageWithParts[] | null>(null);
const SessionPermissionsContext = createContext<SessionPermissionsContextValue | null>(null);
const SessionInfoContext = createContext<OpencodeSessionInfo | null>(null);
const SessionStatusContext = createContext<OpencodeSessionStatus | null>(null);
const SessionErrorContext = createContext<SessionErrorContextValue | null>(null);
const SessionHistoryContext = createContext<boolean | null>(null);

function useRequiredContext<T>(context: Context<T | null>, name: string) {
  const value = useContext(context);

  if (value === null) {
    throw new Error(`${name} must be used within a SessionLiveProvider.`);
  }

  return value;
}

export function SessionLiveProvider({
  children,
  initialMessages,
  initialPermissions,
  initialSession,
  initialStatus,
  instanceId,
  loadedFullHistory,
}: SessionLiveProviderProps) {
  const [messages, setMessages] = useState<OpencodeMessageWithParts[]>(initialMessages);
  const [pendingPermissions, setPendingPermissions] = useState<OpencodePermissionRequest[]>(initialPermissions);
  const [session, setSession] = useState<OpencodeSessionInfo>(initialSession);
  const [status, setStatus] = useState<OpencodeSessionStatus>(initialStatus);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [hasLoadedFullHistory, setHasLoadedFullHistory] = useState(loadedFullHistory);
  const sessionIdRef = useRef(initialSession.id);
  const revalidator = useRevalidator();

  useEffect(() => {
    if (sessionIdRef.current === initialSession.id) {
      setMessages((current) => mergeMessages(current, initialMessages));
      setPendingPermissions(initialPermissions);
      setSession(initialSession);
      setStatus(initialStatus);
      setHasLoadedFullHistory((current) => current || loadedFullHistory);
      return;
    }

    sessionIdRef.current = initialSession.id;
    setMessages(initialMessages);
    setPendingPermissions(initialPermissions);
    setSession(initialSession);
    setStatus(initialStatus);
    setSessionError(null);
    setHasLoadedFullHistory(loadedFullHistory);
  }, [initialMessages, initialPermissions, initialSession, initialStatus, loadedFullHistory]);

  const clearSessionError = useCallback(() => {
    setSessionError(null);
  }, []);

  const replyPermission = useCallback<SessionPermissionsContextValue["replyPermission"]>(
    async (requestId, reply) => {
      setPendingPermissions((current) => current.filter((permission) => permission.id !== requestId));

      try {
        await replyToOpencodePermissionRequest(instanceId, requestId, reply);
      } catch {
        revalidator.revalidate();
      }
    },
    [instanceId, revalidator],
  );

  useInstanceEvents(
    (event) => {
      switch (event.type) {
        case "session.status": {
          setStatus(event.properties.status);
          return;
        }

        case "session.updated": {
          setSession(event.properties.info);
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
    { instanceId, sessionId: initialSession.id, types: SESSION_EVENT_TYPES },
  );

  const permissionsValue = useMemo<SessionPermissionsContextValue>(
    () => ({ pendingPermissions, replyPermission }),
    [pendingPermissions, replyPermission],
  );
  const errorValue = useMemo<SessionErrorContextValue>(
    () => ({ clearSessionError, sessionError }),
    [clearSessionError, sessionError],
  );

  return (
    <SessionInfoContext.Provider value={session}>
      <SessionStatusContext.Provider value={status}>
        <SessionHistoryContext.Provider value={hasLoadedFullHistory}>
          <SessionErrorContext.Provider value={errorValue}>
            <SessionPermissionsContext.Provider value={permissionsValue}>
              <SessionMessagesContext.Provider value={messages}>{children}</SessionMessagesContext.Provider>
            </SessionPermissionsContext.Provider>
          </SessionErrorContext.Provider>
        </SessionHistoryContext.Provider>
      </SessionStatusContext.Provider>
    </SessionInfoContext.Provider>
  );
}

export function useSessionMessages() {
  return useRequiredContext(SessionMessagesContext, "useSessionMessages");
}

export function useSessionPermissions() {
  return useRequiredContext(SessionPermissionsContext, "useSessionPermissions");
}

export function useSessionInfo() {
  return useRequiredContext(SessionInfoContext, "useSessionInfo");
}

export function useSessionStatus() {
  return useRequiredContext(SessionStatusContext, "useSessionStatus");
}

export function useHasLoadedFullHistory() {
  return useRequiredContext(SessionHistoryContext, "useHasLoadedFullHistory");
}

export function useSessionErrorState() {
  return useRequiredContext(SessionErrorContext, "useSessionErrorState");
}
