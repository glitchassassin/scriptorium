import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MessageCard } from "~/components/session/message-card";

describe("MessageCard", () => {
  it("hides synthetic and attachment-expanded user content", () => {
    const { container } = render(
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
              mime: "text/plain",
              url: "file:///tmp/example.txt",
            },
          ],
        }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
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
    expect(screen.queryByText(/File attachment/i)).not.toBeInTheDocument();
  });

  it("renders assistant tool content", () => {
    render(
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
