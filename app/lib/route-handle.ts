export type RouteHandleIconAction = {
  icon: string;
  label: string;
  to: string;
  end?: boolean;
};

export type RouteHandleTitle = string | ((match: { data?: unknown; params: Record<string, string | undefined> }) => string);

export type RouteHandle = {
  title?: RouteHandleTitle;
  iconNavActions?: RouteHandleIconAction[];
};
