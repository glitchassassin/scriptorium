import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const revalidate = vi.fn();

vi.mock("react-router", () => ({
  useRevalidator: () => ({ revalidate }),
}));

import {
  resetEventStreamReconnectRevalidationForTests,
  useEventStreamReconnectRevalidation,
} from "~/components/events/use-event-stream-reconnect-revalidation";

let triggerReconnect: (() => void) | null = null;

function TestComponent() {
  triggerReconnect = useEventStreamReconnectRevalidation();
  return null;
}

async function flushMicrotasks() {
  await Promise.resolve();
}

describe("useEventStreamReconnectRevalidation", () => {
  afterEach(() => {
    triggerReconnect = null;
    revalidate.mockReset();
    resetEventStreamReconnectRevalidationForTests();
  });

  it("revalidates when reconnect callback is triggered", async () => {
    render(<TestComponent />);

    triggerReconnect?.();

    await flushMicrotasks();

    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it("coalesces repeated reconnect callbacks into a single revalidation", async () => {
    render(<TestComponent />);

    triggerReconnect?.();
    triggerReconnect?.();

    await flushMicrotasks();

    expect(revalidate).toHaveBeenCalledTimes(1);
  });
});
