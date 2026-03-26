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

import { useInstanceEvents } from "~/components/events/instance-events-provider";
import type {
  OpencodeSessionInfo,
  OpencodeSessionStatus,
} from "~/lib/opencode/events";

const SESSION_EVENT_TYPES = [
  "session.updated",
  "session.status",
  "session.error",
] as const;

type SessionErrorContextValue = {
  clearSessionError: () => void;
  sessionError: string | null;
};

type SessionLiveProviderProps = {
  children: ReactNode;
  initialSession: OpencodeSessionInfo;
  initialStatus: OpencodeSessionStatus;
  instanceId: string;
};

const SessionInfoContext = createContext<OpencodeSessionInfo | null>(null);
const SessionStatusContext = createContext<OpencodeSessionStatus | null>(null);
const SessionErrorContext = createContext<SessionErrorContextValue | null>(null);

function useRequiredContext<T>(context: Context<T | null>, name: string) {
  const value = useContext(context);

  if (value === null) {
    throw new Error(`${name} must be used within a SessionLiveProvider.`);
  }

  return value;
}

export function SessionLiveProvider({
  children,
  initialSession,
  initialStatus,
  instanceId,
}: SessionLiveProviderProps) {
  const [session, setSession] = useState<OpencodeSessionInfo>(initialSession);
  const [status, setStatus] = useState<OpencodeSessionStatus>(initialStatus);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const sessionIdRef = useRef(initialSession.id);

  useEffect(() => {
    if (sessionIdRef.current === initialSession.id) {
      setSession(initialSession);
      setStatus(initialStatus);
      return;
    }

    sessionIdRef.current = initialSession.id;
    setSession(initialSession);
    setStatus(initialStatus);
    setSessionError(null);
  }, [initialSession, initialStatus]);

  const clearSessionError = useCallback(() => {
    setSessionError(null);
  }, []);

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

        default:
          return;
      }
    },
    { instanceId, sessionId: initialSession.id, types: SESSION_EVENT_TYPES },
  );
  const errorValue = useMemo<SessionErrorContextValue>(
    () => ({ clearSessionError, sessionError }),
    [clearSessionError, sessionError],
  );

  return (
    <SessionInfoContext.Provider value={session}>
      <SessionStatusContext.Provider value={status}>
        <SessionErrorContext.Provider value={errorValue}>{children}</SessionErrorContext.Provider>
      </SessionStatusContext.Provider>
    </SessionInfoContext.Provider>
  );
}

export function useSessionInfo() {
  return useRequiredContext(SessionInfoContext, "useSessionInfo");
}

export function useSessionStatus() {
  return useRequiredContext(SessionStatusContext, "useSessionStatus");
}

export function useSessionErrorState() {
  return useRequiredContext(SessionErrorContext, "useSessionErrorState");
}
