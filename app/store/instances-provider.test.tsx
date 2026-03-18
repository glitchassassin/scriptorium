import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  InstancesProvider,
  getInitialInstances,
} from "~/store/instances-provider";
import {
  useHasVisibleUnreadSessions,
  useVisibleSidebarInstances,
} from "~/components/shell/sidebar-state";
import { SessionsProvider, type SessionState } from "~/store/sessions-provider";

const useInstanceEventsMock = vi.fn();
const useReadStatusEventsMock = vi.fn();

vi.mock("~/components/events/instance-events-provider", () => ({
  useInstanceEvents: (...args: unknown[]) => useInstanceEventsMock(...args),
}));

vi.mock("~/components/events/read-status-events-provider", () => ({
  useReadStatusEvents: (...args: unknown[]) => useReadStatusEventsMock(...args),
}));

function TestConsumer() {
  const instances = useVisibleSidebarInstances();
  const hasVisibleUnread = useHasVisibleUnreadSessions();

  return (
    <div>
      <span data-testid="instance-count">{String(instances.length)}</span>
      <span data-testid="session-ids">{instances.flatMap((instance) => instance.sessionIds).join(",")}</span>
      <span data-testid="has-unread">{String(hasVisibleUnread)}</span>
    </div>
  );
}

describe("InstancesProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-18T00:00:00Z"));
    useInstanceEventsMock.mockReset();
    useReadStatusEventsMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("derives visible instances from sessions and instance events", () => {
    const instanceEventHandlers: Array<(event: any) => void> = [];

    useInstanceEventsMock.mockImplementation((handler: (event: any) => void) => {
      instanceEventHandlers.push(handler);
    });
    useReadStatusEventsMock.mockImplementation(() => {});

    const initialSessions: Record<string, SessionState> = {
      "session-1": {
        id: "session-1",
        title: "Session 1",
        directory: null,
        createdAt: Date.now() - 2_000,
        updatedAt: Date.now() - 1_000,
        lastReadAt: null,
      },
    };

    render(
      <SessionsProvider initialSessions={initialSessions}>
        <InstancesProvider
          initialInstances={getInitialInstances([
            {
              id: "instance-1",
              name: "Alpha",
              status: "running",
              recentSessions: [initialSessions["session-1"]],
            },
          ])}
        >
          <TestConsumer />
        </InstancesProvider>
      </SessionsProvider>,
    );

    expect(screen.getByTestId("instance-count")).toHaveTextContent("1");
    expect(screen.getByTestId("session-ids")).toHaveTextContent("session-1");
    expect(screen.getByTestId("has-unread")).toHaveTextContent("true");

    if (!instanceEventHandlers.length) {
      throw new Error("Missing instance event handler");
    }

    act(() => {
      for (const instanceEventHandler of instanceEventHandlers) {
        instanceEventHandler({
        type: "session.created",
        instanceId: "instance-1",
        properties: {
          info: {
            id: "session-2",
            title: "Session 2",
            directory: null,
            time: { created: Date.now(), updated: Date.now() },
          },
        },
        });
      }
    });

    expect(screen.getByTestId("session-ids")).toHaveTextContent("session-2,session-1");

    act(() => {
      for (const instanceEventHandler of instanceEventHandlers) {
        instanceEventHandler({
        type: "session.deleted",
        instanceId: "instance-1",
        properties: {
          info: {
            id: "session-1",
          },
        },
        });
      }
    });

    expect(screen.getByTestId("session-ids")).toHaveTextContent("session-2");
  });
});
