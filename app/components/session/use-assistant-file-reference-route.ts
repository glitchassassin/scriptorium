import { useOptionalRouteParams } from "./use-optional-route-params";

type AssistantFileReferenceRouteOverrides = {
  filesPath?: string;
  projectId?: string;
};

export function useAssistantFileReferenceRoute(overrides: AssistantFileReferenceRouteOverrides = {}) {
  const params = useOptionalRouteParams();
  const projectId = overrides.projectId ?? params.projectId;
  const filesPath = overrides.filesPath
    ?? (projectId && params.sessionId ? `/projects/${projectId}/sessions/${params.sessionId}/files` : undefined);

  return {
    filesPath,
    projectId,
  };
}
