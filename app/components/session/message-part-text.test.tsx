import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MessagePartText } from "~/components/session/message-part-text";

describe("MessagePartText", () => {
  it("renders assistant markdown, safe links, and code blocks", () => {
    const { container } = render(
      <MessagePartText
        part={{
          id: "part-1",
          sessionID: "session-1",
          messageID: "message-1",
          type: "text",
          text: "# Heading\n\nVisit [Example](https://example.com).\n\n```ts\nconst answer = 42;\n```",
        }}
        role="assistant"
      />,
    );

    expect(screen.getByRole("heading", { name: "Heading" })).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "Example" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer noopener");

    expect(container.querySelector("code")?.textContent).toContain("const answer = 42;");
  });

  it("allows safe html and strips unsafe html", () => {
    const { container } = render(
      <MessagePartText
        part={{
          id: "part-1",
          sessionID: "session-1",
          messageID: "message-1",
          type: "text",
          text: "<details open><summary>More</summary><strong onclick=\"alert(1)\">safe</strong><script>alert(1)</script></details>",
        }}
        role="assistant"
      />,
    );

    expect(screen.getByText("More")).toBeInTheDocument();

    const strong = screen.getByText("safe");
    expect(strong.tagName).toBe("STRONG");
    expect(strong).not.toHaveAttribute("onclick");
    expect(container.querySelector("script")).not.toBeInTheDocument();
  });

  it("keeps user text as plain text", () => {
    render(
      <MessagePartText
        part={{
          id: "part-1",
          sessionID: "session-1",
          messageID: "message-1",
          type: "text",
          text: "# Not markdown",
        }}
        role="user"
      />,
    );

    expect(screen.getByText("# Not markdown")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Not markdown" })).not.toBeInTheDocument();
  });
});
