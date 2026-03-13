export type RouteHandleIconAction = {
  icon: string;
  label: string;
  to: string;
  end?: boolean;
};

export type RouteHandleTitle = string | ((match: { data?: unknown; params: Record<string, string | undefined> }) => string);

export type RouteHandleIconActions =
  | RouteHandleIconAction[]
  | ((match: { data?: unknown; params: Record<string, string | undefined> }) => RouteHandleIconAction[]);

export type RouteHandle = {
  title?: RouteHandleTitle;
  iconNavActions?: RouteHandleIconActions;
};
