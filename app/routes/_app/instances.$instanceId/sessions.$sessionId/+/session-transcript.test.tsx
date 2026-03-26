import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const revalidate = vi.fn();
const listOpencodeMessagePageClient = vi.fn();

vi.mock("react-router", () => ({
  useRevalidator: () => ({ revalidate }),
}));

vi.mock("~/components/events/instance-events-provider", () => ({
  useInstanceEvents: () => {},
}));

vi.mock("~/components/session/message-card", () => ({
  MessageCard: ({ message }: { message: { info: { id: string } } }) => <div data-testid="message-card">{message.info.id}</div>,
}));

vi.mock("~/components/session/permission-card", () => ({
  PermissionCard: () => null,
}));

vi.mock("~/components/session/question-card", () => ({
  QuestionCard: () => null,
}));

vi.mock("~/components/session/session-revert-dock", () => ({
  SessionRevertDock: () => null,
}));

vi.mock("~/components/shell/use-sticky-bottom-scroll", () => ({
  useStickyBottomScroll: () => {},
}));

vi.mock("~/lib/instances/opencode.client", () => ({
  listOpencodeMessagePageClient: (...args: unknown[]) => listOpencodeMessagePageClient(...args),
  rejectOpencodeQuestionRequest: vi.fn(),
  replyToOpencodePermissionRequest: vi.fn(),
  replyToOpencodeQuestionRequest: vi.fn(),
}));

import type { OpencodeMessageWithParts } from "~/lib/opencode/events";
import { SessionTranscript } from "~/routes/_app/instances.$instanceId/sessions.$sessionId/+/session-transcript";

function mockElementMetrics(element: HTMLElement, metrics: Partial<HTMLElement>) {
  if ("clientHeight" in metrics && metrics.clientHeight !== undefined) {
    Object.defineProperty(element, "clientHeight", {
      configurable: true,
      value: metrics.clientHeight,
    });
  }

  if ("scrollHeight" in metrics && metrics.scrollHeight !== undefined) {
    Object.defineProperty(element, "scrollHeight", {
      configurable: true,
      value: metrics.scrollHeight,
    });
  }

  if ("scrollTop" in metrics && metrics.scrollTop !== undefined) {
    Object.defineProperty(element, "scrollTop", {
      configurable: true,
      writable: true,
      value: metrics.scrollTop,
    });
  }
}

function message(id: string, created: number, text: string): OpencodeMessageWithParts {
  return {
    info: {
      id,
      sessionID: "session-1",
      role: "user",
      time: { created },
    },
    parts: [
      {
        id: `${id}-part`,
        messageID: id,
        sessionID: "session-1",
        text,
        type: "text",
      },
    ],
  };
}

describe("SessionTranscript", () => {
  afterEach(() => {
    listOpencodeMessagePageClient.mockReset();
    revalidate.mockReset();
    vi.clearAllMocks();
  });

  function renderTranscript() {
    const view = render(
      <SessionTranscript
        actionPath="/instances/instance-1/sessions/session-1"
        initialHistoryCursor="cursor-1"
        initialMessages={[message("message-2", 2, "current"), message("message-3", 3, "latest")]}
        initialPermissions={[]}
        initialQuestions={[]}
        instanceId="instance-1"
        session={{
          directory: "/tmp",
          id: "session-1",
          time: { created: 1 },
        }}
        status={{ type: "idle" }}
      />,
    );

    const scrollEl = view.container.querySelector(".overflow-y-auto");

    if (!(scrollEl instanceof HTMLElement)) {
      throw new Error("Missing scroll element");
    }

    return { ...view, scrollEl };
  }

  it("revalidates on mount and replaces same-session loader state before local mutations", async () => {
    const view = render(
      <SessionTranscript
        actionPath="/instances/instance-1/sessions/session-1"
        initialHistoryCursor="cursor-1"
        initialMessages={[message("message-2", 2, "current")]}
        initialPermissions={[]}
        initialQuestions={[]}
        instanceId="instance-1"
        session={{
          directory: "/tmp",
          id: "session-1",
          time: { created: 1 },
        }}
        status={{ type: "idle" }}
      />,
    );

    expect(revalidate).toHaveBeenCalledTimes(1);
    expect(screen.getAllByTestId("message-card").map((node) => node.textContent)).toEqual(["message-2"]);

    view.rerender(
      <SessionTranscript
        actionPath="/instances/instance-1/sessions/session-1"
        initialHistoryCursor="cursor-2"
        initialMessages={[message("message-4", 4, "refreshed")]}
        initialPermissions={[]}
        initialQuestions={[]}
        instanceId="instance-1"
        session={{
          directory: "/tmp",
          id: "session-1",
          time: { created: 1 },
        }}
        status={{ type: "idle" }}
      />,
    );

    expect(screen.getAllByTestId("message-card").map((node) => node.textContent)).toEqual(["message-4"]);
  });

  it("loads and prepends older message pages from the top boundary", async () => {
    listOpencodeMessagePageClient.mockResolvedValueOnce({
      hasMore: false,
      items: [message("message-1", 1, "older")],
      nextCursor: null,
    });

    const { scrollEl } = renderTranscript();

    mockElementMetrics(scrollEl, {
      clientHeight: 200,
      scrollHeight: 1000,
      scrollTop: 0,
    });
    fireEvent.scroll(scrollEl);

    mockElementMetrics(scrollEl, {
      clientHeight: 200,
      scrollHeight: 1240,
      scrollTop: 0,
    });

    await waitFor(() => {
      expect(screen.getAllByTestId("message-card")).toHaveLength(3);
    });

    expect(listOpencodeMessagePageClient).toHaveBeenCalledWith("instance-1", "session-1", {
      before: "cursor-1",
      limit: 50,
    });
    expect(screen.getAllByTestId("message-card").map((node) => node.textContent)).toEqual([
      "message-1",
      "message-2",
      "message-3",
    ]);
  });

  it("skips duplicate top-triggered loads while a history request is already in flight", async () => {
    let resolvePage: ((value: { hasMore: boolean; items: OpencodeMessageWithParts[]; nextCursor: string | null }) => void) | undefined;

    listOpencodeMessagePageClient.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolvePage = resolve;
      }),
    );

    const { scrollEl } = renderTranscript();

    mockElementMetrics(scrollEl, {
      clientHeight: 200,
      scrollHeight: 1000,
      scrollTop: 0,
    });
    fireEvent.scroll(scrollEl);

    mockElementMetrics(scrollEl, {
      clientHeight: 200,
      scrollHeight: 1000,
      scrollTop: 40,
    });
    fireEvent.scroll(scrollEl);

    mockElementMetrics(scrollEl, {
      clientHeight: 200,
      scrollHeight: 1000,
      scrollTop: 0,
    });
    fireEvent.scroll(scrollEl);

    expect(listOpencodeMessagePageClient).toHaveBeenCalledTimes(1);

    if (!resolvePage) {
      throw new Error("Expected duplicate load test to capture the page resolver.");
    }

    resolvePage({
      hasMore: false,
      items: [message("message-1", 1, "older")],
      nextCursor: null,
    });

    await waitFor(() => {
      expect(screen.getAllByTestId("message-card")).toHaveLength(3);
    });
  });
});
