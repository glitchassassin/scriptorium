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
    instance: { name: string };
    session: { id: string; title: string | null };
  };
  params: { instanceId: string; sessionId: string };
  matches: readonly [
    {
      id: "routes/_app/_layout";
      data: undefined;
      params: Record<string, string | undefined>;
      handle?: unknown;
    },
    {
      id: "routes/_app/instances.$instanceId/_layout";
      data: undefined;
      params: { instanceId: string };
      handle?: unknown;
    },
    {
      id: "routes/_app/instances.$instanceId/sessions.$sessionId/_layout";
      data: {
        instance: { name: string };
        session: { id: string; title: string | null };
      };
      params: { instanceId: string; sessionId: string };
      handle?: unknown;
    },
  ];
};

type SessionGitRoute = {
  loaderData: {
    instance: { name: string };
  };
  params: { instanceId: string; sessionId: string };
  matches: readonly [
    ...SessionLayoutRoute["matches"],
    {
      id: "routes/_app/instances.$instanceId/sessions.$sessionId/git";
      data: {
        instance: { name: string };
      };
      params: { instanceId: string; sessionId: string };
      handle?: unknown;
    },
  ];
};

describe("route handles", () => {
  it("resolves the deepest title and nearest nav actions independently", () => {
    const sessionHandle: RouteHandleDefinition<SessionLayoutRoute> = defineRouteHandle<SessionLayoutRoute>({
      title: (ctx) => [
        { label: ctx.data.instance.name, to: `/instances/${ctx.params.instanceId}` },
        { label: ctx.data.session.title ?? ctx.data.session.id, to: `/instances/${ctx.params.instanceId}/sessions/${ctx.params.sessionId}` },
      ],
      leadingIconAction: (ctx) => ({
        icon: "mdi:message-plus-outline",
        label: "New session",
        action: `/instances/${ctx.params.instanceId}?index`,
        method: "post",
        fields: { intent: "create-session" },
      }),
      iconNavActions: (ctx) => [
        { icon: "mdi:message-outline", label: "Chat transcript", to: `/instances/${ctx.params.instanceId}/sessions/${ctx.params.sessionId}` },
      ],
    });
    const gitHandle: RouteHandleDefinition<SessionGitRoute> = defineRouteHandle<SessionGitRoute>({
      title: (ctx) => {
        const sessionMatch = ctx.requireMatch("routes/_app/instances.$instanceId/sessions.$sessionId/_layout");

        return [
          { label: sessionMatch.data.instance.name, to: `/instances/${sessionMatch.params.instanceId}` },
          {
            label: sessionMatch.data.session.title ?? sessionMatch.data.session.id,
            to: `/instances/${sessionMatch.params.instanceId}/sessions/${sessionMatch.params.sessionId}`,
          },
          { label: "git" },
        ];
      },
    });

    const matches = normalizeRouteHandleMatches([
      { id: "routes/_app/_layout", data: undefined, handle: undefined, params: {} },
      {
        id: "routes/_app/instances.$instanceId/_layout",
        data: undefined,
        handle: undefined,
        params: { instanceId: "instance-1" },
      },
      {
        id: "routes/_app/instances.$instanceId/sessions.$sessionId/_layout",
        data: { instance: { name: "Workspace" }, session: { id: "session-1", title: "Planning" } },
        handle: sessionHandle,
        params: { instanceId: "instance-1", sessionId: "session-1" },
      },
      {
        id: "routes/_app/instances.$instanceId/sessions.$sessionId/git",
        data: { instance: { name: "Workspace" } },
        handle: gitHandle,
        params: { instanceId: "instance-1", sessionId: "session-1" },
      },
    ] as const);

    expect(resolveRouteHandleValue(matches, "title")).toEqual([
      { label: "Workspace", to: "/instances/instance-1" },
      { label: "Planning", to: "/instances/instance-1/sessions/session-1" },
      { label: "git" },
    ]);
    expect(resolveRouteHandleValue(matches, "leadingIconAction")).toEqual({
      icon: "mdi:message-plus-outline",
      label: "New session",
      action: "/instances/instance-1?index",
      method: "post",
      fields: { intent: "create-session" },
    });
    expect(resolveRouteHandleValue(matches, "iconNavActions")).toEqual([
      { icon: "mdi:message-outline", label: "Chat transcript", to: "/instances/instance-1/sessions/session-1" },
    ]);
  });

  it("formats document titles from the deepest breadcrumb labels", () => {
    expect(getRouteTitleLabels([
      { label: "Workspace" },
      { label: "Planning" },
      { label: "git" },
    ])).toEqual(["git", "Planning"]);
    expect(getDocumentTitle([
      { label: "Workspace" },
      { label: "Planning" },
      { label: "git" },
    ])).toBe("git | Planning | scriptorium");
  });

  it("falls back to the app name when no breadcrumbs are available", () => {
    expect(getRouteTitleLabels(undefined)).toEqual([]);
    expect(getDocumentTitle(undefined)).toBe(APP_NAME);
  });
});
