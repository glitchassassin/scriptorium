import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { MessageCard } from "~/components/session/message-card";

function renderWithRouter(element: ReactNode) {
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element,
      },
    ],
    { initialEntries: ["/"] },
  );

  return render(<RouterProvider router={router} />);
}

describe("MessageCard", () => {
  it("renders user image attachments even without visible text", () => {
    render(
      <MessageCard
        message={{
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
              text: "Called the Read tool...",
              synthetic: true,
            },
            {
              id: "part-2",
              sessionID: "session-1",
              messageID: "message-1",
              type: "file",
              filename: "pasted.png",
              mime: "image/png",
              url: "data:image/png;base64,ZmFrZQ==",
            },
          ],
        }}
      />,
    );

    expect(screen.getByAltText("pasted.png")).toBeInTheDocument();
  });

  it("renders only real user text content", () => {
    render(
      <MessageCard
        message={{
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
              text: "Please inspect this file",
            },
            {
              id: "part-2",
              sessionID: "session-1",
              messageID: "message-1",
              type: "file",
              mime: "text/plain",
              url: "file:///tmp/example.txt",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Please inspect this file")).toBeInTheDocument();
    expect(screen.getByText(/File attachment/i)).toBeInTheDocument();
  });

  it("renders assistant tool content", () => {
    renderWithRouter(
      <MessageCard
        message={{
          info: {
            id: "message-2",
            sessionID: "session-1",
            role: "assistant",
            parentID: "message-1",
            time: { created: 2 },
          },
          parts: [
            {
              id: "part-3",
              sessionID: "session-1",
              messageID: "message-2",
              type: "tool",
              callID: "call-1",
              tool: "bash",
              state: {
                status: "completed",
                input: { command: "pwd" },
                output: "/tmp",
                title: "bash",
                metadata: {},
                time: { start: 1, end: 2 },
              },
            },
          ],
        }}
      />,
    );

    expect(screen.getByText(/assistant/i)).toBeInTheDocument();
    expect(screen.getByText(/bash: pwd/i)).toBeInTheDocument();
  });
});
