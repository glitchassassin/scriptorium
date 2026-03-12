export type RouteHandleIconAction = {
  icon: string;
  label: string;
  to: string;
};

export type RouteHandle = {
  title?: string;
  iconNavActions?: RouteHandleIconAction[];
};
