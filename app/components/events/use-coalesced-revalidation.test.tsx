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
});
