import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BashViewer, renderAnsiToHtml } from "~/components/session/bash-viewer";

describe("BashViewer", () => {
  it("renders ansi color spans as html", () => {
    const html = renderAnsiToHtml("plain \u001b[31mred\u001b[0m done");

    expect(html).toContain("plain ");
    expect(html).toContain("<span style=\"color:var(--color-accent-red)\">red</span>");
    expect(html).toContain(" done");
  });

  it("escapes html in terminal output", () => {
    render(<BashViewer content={"\u001b[32m<tag>\u001b[0m"} />);

    expect(screen.getByText("<tag>")).toBeInTheDocument();
    expect(document.querySelector("tag")).toBeNull();
  });
});
