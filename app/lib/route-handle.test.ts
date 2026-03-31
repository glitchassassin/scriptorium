import { describe, expect, it } from "vitest";

import {
  APP_NAME,
  defineRouteHandle,
  getDocumentTitle,
  getRouteTitleLabels,
  normalizeRouteHandleMatches,
  resolveRouteHandleValue,
  type RouteHandleDefinition,
} from "~/lib/route-handle";

type SessionLayoutRoute = {
  loaderData: {
    project: { name: string };
    session: { id: string; title: string | null };
  };
  params: { projectId: string; sessionId: string };
  matches: readonly [
    {
      id: "routes/_app/_layout";
      data: undefined;
      params: Record<string, string | undefined>;
      handle?: unknown;
    },
    {
      id: "routes/_app/projects.$projectId/_layout";
      data: undefined;
      params: { projectId: string };
      handle?: unknown;
    },
    {
      id: "routes/_app/projects.$projectId/sessions.$sessionId/_layout";
      data: {
        project: { name: string };
        session: { id: string; title: string | null };
      };
      params: { projectId: string; sessionId: string };
      handle?: unknown;
    },
  ];
};

type SessionReviewRoute = {
  loaderData: {
    project: { name: string };
  };
  params: { projectId: string; mode: string; sessionId: string };
  matches: readonly [
    ...SessionLayoutRoute["matches"],
    {
      id: "routes/_app/projects.$projectId/sessions.$sessionId/review.$mode";
      data: {
        project: { name: string };
      };
      params: { projectId: string; mode: string; sessionId: string };
      handle?: unknown;
    },
  ];
};

describe("route handles", () => {
  it("resolves the deepest title and nearest nav actions independently", () => {
    const sessionHandle: RouteHandleDefinition<SessionLayoutRoute> = defineRouteHandle<SessionLayoutRoute>({
      title: (ctx) => [
        { label: ctx.data.project.name, to: `/projects/${ctx.params.projectId}` },
        { label: ctx.data.session.title ?? ctx.data.session.id, to: `/projects/${ctx.params.projectId}/sessions/${ctx.params.sessionId}` },
      ],
      leadingIconAction: (ctx) => ({
        icon: "mdi:message-plus-outline",
        label: "New session",
        action: `/projects/${ctx.params.projectId}?index`,
        method: "post",
        fields: { intent: "create-session" },
      }),
      iconNavActions: (ctx) => [
        { icon: "mdi:message-outline", label: "Chat transcript", to: `/projects/${ctx.params.projectId}/sessions/${ctx.params.sessionId}` },
      ],
    });
    const reviewHandle: RouteHandleDefinition<SessionReviewRoute> = defineRouteHandle<SessionReviewRoute>({
      title: (ctx) => {
        const sessionMatch = ctx.requireMatch("routes/_app/projects.$projectId/sessions.$sessionId/_layout");

        return [
          { label: sessionMatch.data.project.name, to: `/projects/${sessionMatch.params.projectId}` },
          {
            label: sessionMatch.data.session.title ?? sessionMatch.data.session.id,
            to: `/projects/${sessionMatch.params.projectId}/sessions/${sessionMatch.params.sessionId}`,
          },
          { label: "review" },
        ];
      },
    });

    const matches = normalizeRouteHandleMatches([
      { id: "routes/_app/_layout", data: undefined, handle: undefined, params: {} },
      {
        id: "routes/_app/projects.$projectId/_layout",
        data: undefined,
        handle: undefined,
        params: { projectId: "project-1" },
      },
      {
        id: "routes/_app/projects.$projectId/sessions.$sessionId/_layout",
        data: { project: { name: "Workspace" }, session: { id: "session-1", title: "Planning" } },
        handle: sessionHandle,
        params: { projectId: "project-1", sessionId: "session-1" },
      },
      {
        id: "routes/_app/projects.$projectId/sessions.$sessionId/review.$mode",
        data: { project: { name: "Workspace" } },
        handle: reviewHandle,
        params: { projectId: "project-1", mode: "uncommitted", sessionId: "session-1" },
      },
    ] as const);

    expect(resolveRouteHandleValue(matches, "title")).toEqual([
      { label: "Workspace", to: "/projects/project-1" },
      { label: "Planning", to: "/projects/project-1/sessions/session-1" },
      { label: "review" },
    ]);
    expect(resolveRouteHandleValue(matches, "leadingIconAction")).toEqual({
      icon: "mdi:message-plus-outline",
      label: "New session",
      action: "/projects/project-1?index",
      method: "post",
      fields: { intent: "create-session" },
    });
    expect(resolveRouteHandleValue(matches, "iconNavActions")).toEqual([
      { icon: "mdi:message-outline", label: "Chat transcript", to: "/projects/project-1/sessions/session-1" },
    ]);
  });

  it("formats document titles from the deepest breadcrumb labels", () => {
    expect(getRouteTitleLabels([
      { label: "Workspace" },
      { label: "Planning" },
      { label: "review" },
    ])).toEqual(["review", "Planning"]);
    expect(getDocumentTitle([
      { label: "Workspace" },
      { label: "Planning" },
      { label: "review" },
    ])).toBe("review | Planning | scriptorium");
  });

  it("falls back to the app name when no breadcrumbs are available", () => {
    expect(getRouteTitleLabels(undefined)).toEqual([]);
    expect(getDocumentTitle(undefined)).toBe(APP_NAME);
  });
});
