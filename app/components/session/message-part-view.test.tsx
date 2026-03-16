import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MessagePartView } from "~/components/session/message-part-view";
import type { OpencodeMessagePart } from "~/lib/opencode/events";

describe("MessagePartView", () => {
  it("hides user tool and file parts", () => {
    const toolPart: OpencodeMessagePart = {
      id: "part-tool",
      sessionID: "session-1",
      messageID: "message-1",
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
    };

    const filePart: OpencodeMessagePart = {
      id: "part-file",
      sessionID: "session-1",
      messageID: "message-1",
      type: "file",
      mime: "text/plain",
      url: "file:///tmp/example.txt",
    };

    const { container } = render(
      <>
        <MessagePartView part={toolPart} role="user" />
        <MessagePartView part={filePart} role="user" />
      </>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders assistant tool parts", () => {
    const toolPart: OpencodeMessagePart = {
      id: "part-tool",
      sessionID: "session-1",
      messageID: "message-1",
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
    };

    render(<MessagePartView part={toolPart} role="assistant" />);

    expect(screen.getByText(/bash: pwd/i)).toBeInTheDocument();
  });
});
