import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const revalidate = vi.fn();

vi.mock("react-router", () => ({
  useRevalidator: () => ({ revalidate }),
}));

import {
  resetCoalescedRevalidationForTests,
  useCoalescedRevalidation,
} from "~/components/events/use-coalesced-revalidation";

let triggerRevalidation: (() => void) | null = null;

function TestComponent() {
  triggerRevalidation = useCoalescedRevalidation();
  return null;
}

function TestRerenderComponent({ tick }: { tick: number }) {
  triggerRevalidation = useCoalescedRevalidation();
  return <span>{tick}</span>;
}

async function flushMicrotasks() {
  await Promise.resolve();
}

describe("useCoalescedRevalidation", () => {
  afterEach(() => {
    triggerRevalidation = null;
    revalidate.mockReset();
    resetCoalescedRevalidationForTests();
  });

  it("revalidates when triggered", async () => {
    render(<TestComponent />);

    triggerRevalidation?.();

    await flushMicrotasks();

    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it("coalesces repeated callbacks into a single revalidation", async () => {
    render(<TestComponent />);

    triggerRevalidation?.();
    triggerRevalidation?.();

    await flushMicrotasks();

    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it("returns a stable callback across rerenders", () => {
    const view = render(<TestRerenderComponent tick={1} />);
    const firstTrigger = triggerRevalidation;

    view.rerender(<TestRerenderComponent tick={2} />);

    expect(triggerRevalidation).toBe(firstTrigger);
  });
});
