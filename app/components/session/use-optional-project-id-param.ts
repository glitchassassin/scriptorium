import { useOptionalRouteParams } from "./use-optional-route-params";

export function useOptionalProjectIdParam(projectId?: string) {
  const params = useOptionalRouteParams();

  return projectId ?? params.projectId;
}
