export type RouteHandleIconAction = {
  icon: string;
  label: string;
  to: string;
  end?: boolean;
};

export type RouteBreadcrumb = {
  label: string;
  to?: string;
};

export type RouteHandleMatchContext = {
  data?: unknown;
  params: Record<string, string | undefined>;
  matches: Array<{
    data?: unknown;
    params: Record<string, string | undefined>;
  }>;
};

export type RouteHandleTitle =
  | RouteBreadcrumb[]
  | ((match: RouteHandleMatchContext) => RouteBreadcrumb[]);

export type RouteHandleIconActions =
  | RouteHandleIconAction[]
  | ((match: RouteHandleMatchContext) => RouteHandleIconAction[]);

export type RouteHandle = {
  title?: RouteHandleTitle;
  iconNavActions?: RouteHandleIconActions;
};
