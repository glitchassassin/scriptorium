import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PopupPicker } from "~/components/ui/popup-picker";

describe("PopupPicker", () => {
  it("opens below the trigger by default", () => {
    render(
      <PopupPicker
        ariaLabel="Example picker"
        emptyLabel="Choose"
        onSelect={vi.fn()}
        options={[{ label: "Alpha", value: "alpha" }]}
        selectedValue="alpha"
      />, 
    );

    fireEvent.click(screen.getByRole("button", { name: "Example picker" }));

    expect(screen.getByRole("listbox").className).toContain("top-full");
    expect(screen.getByRole("listbox").className).toContain("left-0");
  });

  it("supports opening above the trigger when requested", () => {
    render(
      <PopupPicker
        ariaLabel="Example picker"
        emptyLabel="Choose"
        onSelect={vi.fn()}
        options={[{ label: "Alpha", value: "alpha" }]}
        placement="top-end"
        selectedValue="alpha"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Example picker" }));

    expect(screen.getByRole("listbox").className).toContain("bottom-full");
    expect(screen.getByRole("listbox").className).toContain("right-0");
  });
});
