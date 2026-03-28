import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MessageMarkdown } from "~/components/session/message-markdown";

function renderWithSessionRoute(element: ReactNode, initialEntry = "/instances/instance-1/sessions/session-1") {
  const router = createMemoryRouter(
    [
      {
        path: "/instances/:instanceId/sessions/:sessionId",
        element,
      },
    ],
    { initialEntries: [initialEntry] },
  );

  return render(<RouterProvider router={router} />);
}

describe("MessageMarkdown", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("links resolved assistant file references and inline code spans", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === "string" ? input : input.toString(), "http://localhost");

      expect(url.pathname).toBe("/instances/instance-1/file-references/resolve");
      expect(url.searchParams.getAll("candidate")).toEqual([
        "message-markdown.tsx",
        "docs/e-ink style guide.md",
      ]);

      return new Response(JSON.stringify({
        results: {
          "docs/e-ink style guide.md": { path: "docs/e-ink style guide.md" },
          "message-markdown.tsx": { path: "app/components/session/message-markdown.tsx" },
        },
      }));
    });

    vi.stubGlobal("fetch", fetchMock);

    renderWithSessionRoute(<MessageMarkdown text="See message-markdown.tsx:44 and `docs/e-ink style guide.md`." />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "message-markdown.tsx:44" })).toHaveAttribute(
        "href",
        "/instances/instance-1/sessions/session-1/files?file=app%2Fcomponents%2Fsession%2Fmessage-markdown.tsx&path=app%2Fcomponents%2Fsession&line=44",
      );
    });

    expect(screen.getByRole("link", { name: "docs/e-ink style guide.md" })).toHaveAttribute(
      "href",
      "/instances/instance-1/sessions/session-1/files?file=docs%2Fe-ink+style+guide.md&path=docs",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not resolve fenced code blocks or existing links", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderWithSessionRoute(
      <MessageMarkdown
        text={[
          "[message-markdown.tsx](https://example.com/file)",
          "",
          "```ts",
          "message-markdown.tsx",
          "```",
        ].join("\n")}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "message-markdown.tsx" })).toHaveAttribute("href", "https://example.com/file");
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("leaves unresolved references as plain text", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ results: { "missing-file.ts": null } })));
    vi.stubGlobal("fetch", fetchMock);

    renderWithSessionRoute(<MessageMarkdown text="missing-file.ts" />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByRole("link", { name: "missing-file.ts" })).not.toBeInTheDocument();
    expect(screen.getByText("missing-file.ts")).toBeInTheDocument();
  });

  it("retries negative resolutions after the cache TTL expires", async () => {
    let now = 10_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const instanceId = "instance-retry";
    const fileName = "retry-file.ts";

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: { [fileName]: null } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: { [fileName]: { path: `app/${fileName}` } },
      })));
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <RouterProvider
        router={createMemoryRouter(
          [
            {
              path: "/instances/:instanceId/sessions/:sessionId",
              element: <MessageMarkdown text={fileName} />,
            },
          ],
          { initialEntries: ["/instances/instance-retry/sessions/session-1"] },
        )}
      />,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    rerender(
      <RouterProvider
        router={createMemoryRouter(
          [
            {
              path: "/instances/:instanceId/sessions/:sessionId",
              element: <MessageMarkdown text={`${fileName} updated`} />,
            },
          ],
          { initialEntries: ["/instances/instance-retry/sessions/session-1"] },
        )}
      />,
    );

    now += 5_001;

    rerender(
      <RouterProvider
        router={createMemoryRouter(
          [
            {
              path: "/instances/:instanceId/sessions/:sessionId",
              element: <MessageMarkdown text={`${fileName} retried`} />,
            },
          ],
          { initialEntries: ["/instances/instance-retry/sessions/session-1"] },
        )}
      />,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByRole("link", { name: new RegExp(fileName, "i") })).toHaveAttribute(
        "href",
        `/instances/${instanceId}/sessions/session-1/files?file=app%2F${fileName}&path=app`,
      );
    });
  });
});
