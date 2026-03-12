import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDoubleCheck } from "~/hooks/use-double-check";

function TestButton() {
  const { doubleCheck, getButtonProps } = useDoubleCheck();

  return (
    <button type="button" {...getButtonProps()}>
      {doubleCheck ? "Confirm" : "Delete"}
    </button>
  );
}

describe("useDoubleCheck", () => {
  it("resets after five seconds without a second click", () => {
    vi.useFakeTimers();

    render(<TestButton />);

    const button = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(button);

    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();

    vi.useRealTimers();
  });
});
