import { useOptionalRouteParams } from "./use-optional-route-params";

export function useOptionalInstanceIdParam(instanceId?: string) {
  const params = useOptionalRouteParams();

  return instanceId ?? params.instanceId;
}
