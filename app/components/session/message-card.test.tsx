import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { MessageCard } from "~/components/session/message-card";
import type { OpencodeMessageWithParts } from "~/lib/opencode/events";

describe("MessageCard", () => {
  function renderWithRouter(message: OpencodeMessageWithParts) {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: <MessageCard actionPath="/" message={message} />,
        },
      ],
      { initialEntries: ["/"] },
    );

    return render(<RouterProvider router={router} />);
  }

  it("renders undo and fork actions for user messages", () => {
    const message: OpencodeMessageWithParts = {
      info: {
        id: "message-1",
        sessionID: "session-1",
        role: "user",
        time: { created: 1 },
      },
      parts: [
        {
          id: "part-1",
          sessionID: "session-1",
          messageID: "message-1",
          type: "text",
          text: "Hello",
        },
      ],
    };

    renderWithRouter(message);

    expect(screen.getByRole("button", { name: /undo from this message/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fork from this message/i })).toBeInTheDocument();
  });

  it("does not render actions for assistant messages", () => {
    const message: OpencodeMessageWithParts = {
      info: {
        id: "message-2",
        sessionID: "session-1",
        role: "assistant",
        parentID: "message-1",
        time: { created: 2 },
      },
      parts: [
        {
          id: "part-2",
          sessionID: "session-1",
          messageID: "message-2",
          type: "text",
          text: "Hi",
        },
      ],
    };

    renderWithRouter(message);

    expect(screen.queryByRole("button", { name: /undo from this message/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /fork from this message/i })).not.toBeInTheDocument();
  });
});
