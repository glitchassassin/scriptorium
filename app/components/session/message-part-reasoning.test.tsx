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
          text: "Thinking through the problem",
          time: { start: 1 },
        }}
      />,
    );

    expect(screen.queryByText("Thinking through the problem")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /expand reasoning/i }));
    expect(screen.getByText("Thinking through the problem")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /collapse reasoning/i }));
    expect(screen.queryByText("Thinking through the problem")).not.toBeInTheDocument();
  });
});
