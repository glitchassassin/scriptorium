import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PermissionPrompt } from "~/components/session/permission-prompt";
import type { OpencodeMessageWithParts, OpencodePermissionRequest } from "~/lib/opencode/events";

describe("PermissionPrompt", () => {
  it("keeps title and actions visible while collapsed", () => {
    const onReply = vi.fn();
    const permission: OpencodePermissionRequest = {
      id: "permission-1",
      sessionID: "session-1",
      permission: "read",
      patterns: ["src/app.ts"],
      metadata: {},
      always: [],
    };

    render(<PermissionPrompt messages={[]} onReply={onReply} permission={permission} />);

    expect(screen.getByText("read: src/app.ts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /expand permission details/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve permission" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deny permission" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Always approve permission" })).toBeInTheDocument();
    expect(screen.queryByText("Path")).not.toBeInTheDocument();
  });

  it("uses the same linked tool command in the title and expanded details", () => {
    const onReply = vi.fn();
    const messages: OpencodeMessageWithParts[] = [
      {
        info: {
          id: "message-1",
          sessionID: "session-1",
          role: "assistant",
          parentID: "message-0",
          time: { created: 1 },
        },
        parts: [
          {
            id: "part-1",
            sessionID: "session-1",
            messageID: "message-1",
            type: "tool",
            callID: "call-1",
            tool: "bash",
            state: {
              status: "running",
              input: {
                command: "npm test",
                description: "Run the test suite",
                workdir: "/tmp/project",
                timeout: 120000,
              },
              title: "bash",
              metadata: {
                diff: "@@ -0,0 +1,1 @@\n+const value = 1;",
                filepath: "src/app.ts",
              },
              time: { start: 1 },
            },
          },
        ],
      },
    ];
    const permission: OpencodePermissionRequest = {
      id: "permission-2",
      sessionID: "session-1",
      permission: "bash",
      patterns: [],
      metadata: {
        description: "Run the test suite",
        diff: "@@ -0,0 +1,1 @@\n+const value = 1;",
        filepath: "src/app.ts",
        input: { command: "echo wrong-command" },
      },
      always: [],
      tool: { messageID: "message-1", callID: "call-1" },
    };

    const { container } = render(<PermissionPrompt messages={messages} onReply={onReply} permission={permission} />);

    expect(screen.getByText("bash: npm test")).toBeInTheDocument();
    expect(screen.queryByText("bash: echo wrong-command")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /expand permission details/i }));

    expect(screen.getByRole("button", { name: /collapse permission details/i })).toBeInTheDocument();
    expect(screen.queryByText("What")).not.toBeInTheDocument();
    expect(screen.getByText("Workdir")).toBeInTheDocument();
    expect(screen.getByText("src/app.ts")).toBeInTheDocument();
    expect(container).toHaveTextContent("npm test");
    expect(screen.queryAllByText("Run the test suite")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /collapse permission details/i }));
    expect(screen.getByText("bash: npm test")).toBeInTheDocument();
  });

  it("sends replies from the permission actions", () => {
    const onReply = vi.fn();
    const permission: OpencodePermissionRequest = {
      id: "permission-2",
      sessionID: "session-1",
      permission: "bash",
      patterns: [],
      metadata: {
        description: "Run the test suite",
      },
      always: [],
    };

    render(<PermissionPrompt messages={[]} onReply={onReply} permission={permission} />);

    fireEvent.click(screen.getByRole("button", { name: "Approve permission" }));
    fireEvent.click(screen.getByRole("button", { name: "Deny permission" }));
    fireEvent.click(screen.getByRole("button", { name: "Always approve permission" }));

    expect(onReply).toHaveBeenNthCalledWith(1, "permission-2", "once");
    expect(onReply).toHaveBeenNthCalledWith(2, "permission-2", "reject");
    expect(onReply).toHaveBeenNthCalledWith(3, "permission-2", "always");
  });
});
