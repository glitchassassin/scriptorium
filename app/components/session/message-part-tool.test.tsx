import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MessagePartTool } from "~/components/session/message-part-tool";
import type { OpencodeToolPart } from "~/lib/opencode/events";
import { useOptionalProjectIdParam } from "~/components/session/use-optional-project-id-param";

vi.mock("~/components/session/use-optional-project-id-param", () => ({
  useOptionalProjectIdParam: vi.fn(),
}));

const mockUseOptionalProjectIdParam = vi.mocked(useOptionalProjectIdParam);

describe("MessagePartTool", () => {
  afterEach(() => {
    mockUseOptionalProjectIdParam.mockReset();
    mockUseOptionalProjectIdParam.mockReturnValue(undefined);
  });

  it("renders bash tool output with command text", () => {
    const part: OpencodeToolPart = {
      id: "part-1",
      sessionID: "session-1",
      messageID: "message-1",
      type: "tool",
      callID: "call-1",
      tool: "bash",
      state: {
        status: "completed",
        input: { command: "npm test" },
        output: "\u001b[32mok\u001b[0m",
        title: "bash",
        metadata: {},
        time: { start: 1, end: 2 },
      },
    };

    render(<MessagePartTool part={part} />);

    expect(screen.getByText(/bash: npm test/i)).toBeInTheDocument();
    expect(screen.getByText(/completed/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /expand bash output/i }));

    expect(screen.getByText(/^ok$/)).toBeInTheDocument();
  });

  it("allows long bash commands to wrap", () => {
    const part: OpencodeToolPart = {
      id: "part-bash-long-command",
      sessionID: "session-1",
      messageID: "message-1",
      type: "tool",
      callID: "call-bash-long-command",
      tool: "bash",
      state: {
        status: "completed",
        input: {
          command:
            "parseRuntimeCliArgs|renderRuntimeConfigurationHelp|getRuntimeConfigurationDocumentation|renderRuntimeConfigurationMarkdown|collectSchemaDocumentation|buildDocumentationExample",
        },
        output: "done",
        title: "bash",
        metadata: {},
        time: { start: 1, end: 2 },
      },
    };

    render(<MessagePartTool part={part} />);

    const title = screen.getByText(/bash: parseRuntimeCliArgs\|renderRuntimeConfigurationHelp/i);

    expect(title).toHaveClass("min-w-0", "break-words");
    expect(title.parentElement).toHaveClass("flex", "min-w-0", "items-start");
  });

  it("renders generic tool diffs when metadata provides a patch", () => {
    const part: OpencodeToolPart = {
      id: "part-2",
      sessionID: "session-1",
      messageID: "message-1",
      type: "tool",
      callID: "call-2",
      tool: "write",
      state: {
        status: "completed",
        input: { filePath: "src/app.ts" },
        output: "done",
        title: "write",
        metadata: {
          diff: "@@ -0,0 +1,1 @@\n+const value = 1;",
          filepath: "src/app.ts",
        },
        time: { start: 1, end: 2 },
      },
    };

    render(<MessagePartTool part={part} />);

    fireEvent.click(screen.getByRole("button", { name: /expand tool details/i }));

    expect(screen.getByText("src/app.ts")).toBeInTheDocument();
    expect(screen.getByText("Input")).toBeInTheDocument();
    expect(screen.getByText("Output")).toBeInTheDocument();
  });

  it("allows long generic tool titles to wrap", () => {
    const part: OpencodeToolPart = {
      id: "part-long-title",
      sessionID: "session-1",
      messageID: "message-1",
      type: "tool",
      callID: "call-long-title",
      tool: "grep",
      state: {
        status: "completed",
        input: { pattern: "runtime" },
        output: "done",
        title:
          "parseRuntimeCliArgs|renderRuntimeConfigurationHelp|getRuntimeConfigurationDocumentation|renderRuntimeConfigurationMarkdown|collectSchemaDocumentation|buildDocumentationExample",
        metadata: {},
        time: { start: 1, end: 2 },
      },
    };

    render(<MessagePartTool part={part} />);

    const title = screen.getByText(/grep: parseRuntimeCliArgs\|renderRuntimeConfigurationHelp/i);

    expect(title).toHaveClass("min-w-0", "break-words");
    expect(title.parentElement).toHaveClass("flex", "min-w-0", "items-start");
  });

  it("synthesizes a diff for write tools from input content", () => {
    const part: OpencodeToolPart = {
      id: "part-3",
      sessionID: "session-1",
      messageID: "message-1",
      type: "tool",
      callID: "call-3",
      tool: "write",
      state: {
        status: "completed",
        input: { filePath: "src/output.ts", content: "const answer = 42;" },
        output: "written",
        title: "write",
        metadata: {},
        time: { start: 1, end: 2 },
      },
    };

    const { container } = render(<MessagePartTool part={part} />);

    fireEvent.click(screen.getByRole("button", { name: /expand tool details/i }));

    expect(screen.getByText("src/output.ts")).toBeInTheDocument();
    expect(container).toHaveTextContent("const answer = 42;");
  });

  it("renders error and attachments for generic tools", () => {
    const part: OpencodeToolPart = {
      id: "part-4",
      sessionID: "session-1",
      messageID: "message-1",
      type: "tool",
      callID: "call-4",
      tool: "read",
      state: {
        status: "error",
        input: { filePath: "src/app.ts" },
        error: "Permission denied",
        metadata: {},
        time: { start: 1, end: 2 },
      },
    };

    const completedPart: OpencodeToolPart = {
      id: "part-5",
      sessionID: "session-1",
      messageID: "message-1",
      type: "tool",
      callID: "call-5",
      tool: "read",
      state: {
        status: "completed",
        input: { filePath: "src/app.ts" },
        output: "done",
        title: "read",
        metadata: {},
        time: { start: 1, end: 2 },
        attachments: [
          {
            id: "file-1",
            sessionID: "session-1",
            messageID: "message-1",
            type: "file",
            mime: "text/plain",
            filename: "result.txt",
            url: "file:///tmp/result.txt",
          },
        ],
      },
    };

    const { rerender } = render(<MessagePartTool part={part} />);

    fireEvent.click(screen.getByRole("button", { name: /expand tool details/i }));
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Permission denied")).toBeInTheDocument();

    rerender(<MessagePartTool part={completedPart} />);
    expect(screen.getByText("Attachments")).toBeInTheDocument();
    expect(screen.getByText("result.txt")).toBeInTheDocument();
  });

  it("renders dedicated task links with status and arrow", () => {
    const part: OpencodeToolPart = {
      id: "part-6",
      sessionID: "session-1",
      messageID: "message-1",
      type: "tool",
      callID: "call-6",
      tool: "task",
      state: {
        status: "completed",
        input: {
          description: "Investigate transcript links",
          prompt: "Check the transcript rendering flow",
          subagent_type: "explore",
        },
        output: "done",
        title: "task",
        metadata: {
          sessionId: "session-child",
        },
        time: { start: 1, end: 2 },
      },
    };

    mockUseOptionalProjectIdParam.mockReturnValue("project-1");

    render(
      <MemoryRouter>
        <MessagePartTool part={part} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Task (completed)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /investigate transcript links/i })).toHaveAttribute(
      "href",
      "/projects/project-1/sessions/session-child",
    );
    expect(screen.getByRole("link", { name: /investigate transcript links/i })).toHaveClass("underline");
  });

  it("allows long task labels to wrap", () => {
    const part: OpencodeToolPart = {
      id: "part-task-long-label",
      sessionID: "session-1",
      messageID: "message-1",
      type: "tool",
      callID: "call-task-long-label",
      tool: "task",
      state: {
        status: "completed",
        input: {
          description:
            "parseRuntimeCliArgs|renderRuntimeConfigurationHelp|getRuntimeConfigurationDocumentation|renderRuntimeConfigurationMarkdown|collectSchemaDocumentation|buildDocumentationExample",
          prompt: "Check the transcript rendering flow",
          subagent_type: "explore",
        },
        output: "done",
        title: "task",
        metadata: {
          sessionId: "session-child",
        },
        time: { start: 1, end: 2 },
      },
    };

    mockUseOptionalProjectIdParam.mockReturnValue("project-1");

    render(
      <MemoryRouter>
        <MessagePartTool part={part} />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", {
      name: /parseRuntimeCliArgs\|renderRuntimeConfigurationHelp/i,
    });
    const label = screen.getByText(/parseRuntimeCliArgs\|renderRuntimeConfigurationHelp/i);

    expect(link).toHaveClass("flex", "min-w-0", "items-start");
    expect(label).toHaveClass("min-w-0", "break-words");
  });
});
