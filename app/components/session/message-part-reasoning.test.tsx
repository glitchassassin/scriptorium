import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MessagePartReasoning } from "~/components/session/message-part-reasoning";

describe("MessagePartReasoning", () => {
  it("toggles reasoning visibility", () => {
    render(
      <MessagePartReasoning
        part={{
          id: "part-1",
          sessionID: "session-1",
          messageID: "message-1",
          type: "reasoning",
          text: "## Thinking\n\n- first pass\n- second pass",
          time: { start: 1 },
        }}
      />,
    );

    expect(screen.queryByRole("heading", { name: "Thinking" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /expand reasoning/i }));
    expect(screen.getByRole("heading", { name: "Thinking" })).toBeInTheDocument();
    expect(screen.getByText("first pass")).toBeInTheDocument();
    expect(screen.getByText("second pass")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /collapse reasoning/i }));
    expect(screen.queryByRole("heading", { name: "Thinking" })).not.toBeInTheDocument();
  });
});
