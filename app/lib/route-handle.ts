type RouteParams = Record<string, string | undefined>;

export type RouteHandleIconLinkAction = {
  icon: string;
  label: string;
  to: string;
  end?: boolean;
};

export type RouteHandleIconSubmitAction = {
  icon: string;
  label: string;
  action: string;
  method: "get" | "post";
  fields?: Record<string, string>;
};

export type RouteHandleIconAction = RouteHandleIconLinkAction | RouteHandleIconSubmitAction;

export type RouteBreadcrumb = {
  label: string;
  to?: string;
};

type RouteMatchLike = {
  id: string;
  data?: unknown;
  params: RouteParams;
  handle?: unknown;
};

export type RouteComponentPropsLike = {
  loaderData: unknown;
  params: RouteParams;
  matches: readonly (RouteMatchLike | undefined)[];
};

type RouteHandleValue<TValue, TComponentProps extends RouteComponentPropsLike> =
  | TValue
  | ((ctx: RouteHandleContext<TComponentProps>) => TValue);

export type RouteHandleContext<TComponentProps extends RouteComponentPropsLike> = {
  data: TComponentProps["loaderData"];
  params: TComponentProps["params"];
  matches: TComponentProps["matches"];
  getMatch<TId extends RouteMatchId<TComponentProps>>(id: TId): RouteMatchById<TComponentProps, TId> | undefined;
  requireMatch<TId extends RouteMatchId<TComponentProps>>(id: TId): RouteMatchById<TComponentProps, TId>;
};

export type RouteHandleDefinition<TComponentProps extends RouteComponentPropsLike> = {
  title?: RouteHandleValue<RouteBreadcrumb[], TComponentProps>;
  leadingIconAction?: RouteHandleValue<RouteHandleIconAction | undefined, TComponentProps>;
  iconNavActions?: RouteHandleValue<RouteHandleIconAction[], TComponentProps>;
};

export type RouteHandle = RouteHandleDefinition<RouteComponentPropsLike>;

export type RouteHandleKey = keyof Pick<RouteHandle, "title" | "leadingIconAction" | "iconNavActions">;

export type ResolvedHandleValueMap = {
  title: RouteBreadcrumb[];
  leadingIconAction: RouteHandleIconAction | undefined;
  iconNavActions: RouteHandleIconAction[];
};

export const APP_NAME = "scriptorium";

type RouteMatchById<TComponentProps extends RouteComponentPropsLike, TId extends RouteMatchId<TComponentProps>> = Extract<
  Exclude<TComponentProps["matches"][number], undefined>,
  { id: TId }
>;

type RouteMatchId<TComponentProps extends RouteComponentPropsLike> = Exclude<TComponentProps["matches"][number], undefined>["id"];

type NormalizedRouteMatch<TMatch extends RouteMatchLike> = Omit<TMatch, "handle"> & {
  handle?: RouteHandle;
};

function isDefined<TValue>(value: TValue | undefined): value is TValue {
  return value !== undefined;
}

function isNonEmptyString(value: string | undefined): value is string {
  return Boolean(value?.trim());
}

type RuntimeRouteHandleContext = {
  data: unknown;
  params: RouteParams;
  matches: NormalizedRouteMatch<RouteMatchLike>[];
  getMatch(id: string): NormalizedRouteMatch<RouteMatchLike> | undefined;
  requireMatch(id: string): NormalizedRouteMatch<RouteMatchLike>;
};

function hasHandleKey(match: NormalizedRouteMatch<RouteMatchLike>, key: RouteHandleKey) {
  return match.handle?.[key] !== undefined;
}

function isMatchId<TMatch extends RouteMatchLike, TId extends TMatch["id"]>(
  match: TMatch,
  id: TId,
): match is Extract<TMatch, { id: TId }> {
  return match.id === id;
}

function createRouteHandleContext<TMatch extends RouteMatchLike>(
  matches: NormalizedRouteMatch<TMatch>[],
  activeMatch: NormalizedRouteMatch<TMatch>,
) {
  return {
    data: activeMatch.data,
    params: activeMatch.params,
    matches,
    getMatch<TId extends TMatch["id"]>(id: TId) {
      return matches.find((match) => isMatchId(match, id));
    },
    requireMatch<TId extends TMatch["id"]>(id: TId) {
      const match = matches.find((candidate) => isMatchId(candidate, id));

      if (!match) {
        throw new Error(`Route handle match not found for id: ${id}`);
      }

      return match;
    },
  };
}

export function defineRouteHandle<TComponentProps extends RouteComponentPropsLike>(
  handle: RouteHandleDefinition<TComponentProps>,
): RouteHandleDefinition<TComponentProps> {
  return handle;
}

export function normalizeRouteHandleMatches<TMatches extends readonly (RouteMatchLike | undefined)[]>(matches: TMatches) {
  return matches.filter(isDefined).map((match) => ({
    ...match,
    handle: match.handle as RouteHandle | undefined,
  })) as Array<NormalizedRouteMatch<Exclude<TMatches[number], undefined>>>;
}

export function resolveRouteHandleValue(
  matches: NormalizedRouteMatch<RouteMatchLike>[],
  key: "title",
): RouteBreadcrumb[] | undefined;
export function resolveRouteHandleValue(
  matches: NormalizedRouteMatch<RouteMatchLike>[],
  key: "iconNavActions",
): RouteHandleIconAction[] | undefined;
export function resolveRouteHandleValue(
  matches: NormalizedRouteMatch<RouteMatchLike>[],
  key: "leadingIconAction",
): RouteHandleIconAction | undefined;
export function resolveRouteHandleValue(matches: NormalizedRouteMatch<RouteMatchLike>[], key: RouteHandleKey) {
  const activeMatch = [...matches].reverse().find((match) => hasHandleKey(match, key));

  if (!activeMatch?.handle) {
    return undefined;
  }

  const value = activeMatch.handle[key];

  if (typeof value !== "function") {
    return value;
  }

  const context = createRouteHandleContext(matches, activeMatch) satisfies RuntimeRouteHandleContext;
  return value(context);
}

export function getRouteTitleLabels(breadcrumbs: RouteBreadcrumb[] | undefined, maxItems = 2) {
  if (!breadcrumbs?.length) {
    return [];
  }

  const labels = breadcrumbs.map((breadcrumb) => breadcrumb.label?.trim()).filter(isNonEmptyString);

  if (maxItems <= 0) {
    return labels;
  }

  return labels.slice(-maxItems).reverse();
}

export function getDocumentTitle(breadcrumbs?: RouteBreadcrumb[]) {
  const labels = getRouteTitleLabels(breadcrumbs);

  return labels.length ? [...labels, APP_NAME].join(" | ") : APP_NAME;
}
