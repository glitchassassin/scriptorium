import { useContext } from "react";
import { UNSAFE_RouteContext } from "react-router";

export function useOptionalRouteParams() {
  const routeContext = useContext(UNSAFE_RouteContext);

  // These transcript components are sometimes rendered in isolated tests without a router.
  // Reading params from the route context lets the hooks no-op in that case instead of throwing.
  return routeContext.matches.reduce<Record<string, string | undefined>>(
    (currentParams, match) => ({ ...currentParams, ...match.params }),
    {},
  );
}
