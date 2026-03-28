import { useOptionalRouteParams } from "./use-optional-route-params";

type AssistantFileReferenceRouteOverrides = {
  filesPath?: string;
  instanceId?: string;
};

export function useAssistantFileReferenceRoute(overrides: AssistantFileReferenceRouteOverrides = {}) {
  const params = useOptionalRouteParams();
  const instanceId = overrides.instanceId ?? params.instanceId;
  const filesPath = overrides.filesPath
    ?? (instanceId && params.sessionId ? `/instances/${instanceId}/sessions/${params.sessionId}/files` : undefined);

  return {
    filesPath,
    instanceId,
  };
}
