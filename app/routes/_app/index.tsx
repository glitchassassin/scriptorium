import { redirect } from "react-router";

import type { Route } from "./+types/index";

export async function loader(_: Route.LoaderArgs) {
  throw redirect("/instances");
}

export default function AppIndexRoute() {
  return null;
}
