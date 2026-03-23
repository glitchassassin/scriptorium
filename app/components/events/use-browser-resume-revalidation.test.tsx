import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const revalidate = vi.fn();

vi.mock("react-router", () => ({
  useRevalidator: () => ({ revalidate }),
}));

import { useBrowserResumeRevalidation } from "~/components/events/use-browser-resume-revalidation";
import { resetCoalescedRevalidationForTests } from "~/components/events/use-coalesced-revalidation";

function TestComponent() {
  useBrowserResumeRevalidation();
  return null;
}

async function flushMicrotasks() {
  await Promise.resolve();
}

function setVisibilityState(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
}

describe("useBrowserResumeRevalidation", () => {
  afterEach(() => {
    revalidate.mockReset();
    resetCoalescedRevalidationForTests();
    setVisibilityState("visible");
  });

  it("revalidates when the window regains focus", async () => {
    render(<TestComponent />);

    window.dispatchEvent(new Event("focus"));

    await flushMicrotasks();

    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it("revalidates when the document becomes visible", async () => {
    render(<TestComponent />);

    setVisibilityState("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    await flushMicrotasks();

    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it("revalidates on pageshow", async () => {
    render(<TestComponent />);

    window.dispatchEvent(new Event("pageshow"));

    await flushMicrotasks();

    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it("does not revalidate on blur or hidden transitions", async () => {
    render(<TestComponent />);

    window.dispatchEvent(new Event("blur"));
    setVisibilityState("hidden");
    document.dispatchEvent(new Event("visibilitychange"));

    await flushMicrotasks();

    expect(revalidate).not.toHaveBeenCalled();
  });

  it("coalesces multiple resume events into a single revalidation", async () => {
    render(<TestComponent />);

    window.dispatchEvent(new Event("focus"));
    setVisibilityState("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("pageshow"));

    await flushMicrotasks();

    expect(revalidate).toHaveBeenCalledTimes(1);
  });
});
