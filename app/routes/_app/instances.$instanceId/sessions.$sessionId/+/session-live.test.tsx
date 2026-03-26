import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const useInstanceEvents = vi.fn();

vi.mock("~/components/events/instance-events-provider", () => ({
  useInstanceEvents: (...args: unknown[]) => useInstanceEvents(...args),
}));

import {
  SessionLiveProvider,
  useSessionErrorState,
  useSessionInfo,
  useSessionStatus,
} from "~/routes/_app/instances.$instanceId/sessions.$sessionId/+/session-live";

function Harness() {
  const session = useSessionInfo();
  const status = useSessionStatus();
  const { clearSessionError, sessionError } = useSessionErrorState();

  return (
    <>
      <span data-testid="session-id">{session.id}</span>
      <span data-testid="status-type">{status.type}</span>
      <span data-testid="session-error">{sessionError ?? ""}</span>
      <button onClick={clearSessionError} type="button">Clear error</button>
    </>
  );
}

describe("SessionLiveProvider", () => {
  afterEach(() => {
    useInstanceEvents.mockReset();
    vi.clearAllMocks();
  });

  it("surfaces live session info, status, and errors", () => {
    let callback: ((event: { type: string; properties: any }) => void) | undefined;

    useInstanceEvents.mockImplementation((nextCallback: typeof callback) => {
      callback = nextCallback;
    });

    render(
      <SessionLiveProvider
        initialSession={{
          directory: "/tmp",
          id: "session-1",
          time: { created: 1 },
        }}
        initialStatus={{ type: "idle" }}
        instanceId="instance-1"
      >
        <Harness />
      </SessionLiveProvider>,
    );

    expect(screen.getByTestId("session-id")).toHaveTextContent("session-1");
    expect(screen.getByTestId("status-type")).toHaveTextContent("idle");

    act(() => {
      callback?.({
        type: "session.updated",
        properties: {
          info: {
            directory: "/tmp/next",
            id: "session-2",
            time: { created: 2 },
          },
        },
      });
      callback?.({
        type: "session.status",
        properties: {
          status: { message: "Retrying", next: 10, type: "retry" },
        },
      });
      callback?.({
        type: "session.error",
        properties: {
          error: { message: "Boom", name: "Error" },
        },
      });
    });

    expect(screen.getByTestId("session-id")).toHaveTextContent("session-2");
    expect(screen.getByTestId("status-type")).toHaveTextContent("retry");
    expect(screen.getByTestId("session-error")).toHaveTextContent("Boom");

    fireEvent.click(screen.getByRole("button", { name: "Clear error" }));

    expect(screen.getByTestId("session-error")).toHaveTextContent("");
  });
});
