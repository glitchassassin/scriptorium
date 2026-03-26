import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QuestionPrompt } from "~/components/session/question-prompt";
import type { OpencodeQuestionRequest } from "~/lib/opencode/events";

describe("QuestionPrompt", () => {
  it("renders the question details and supports collapsing", () => {
    const request: OpencodeQuestionRequest = {
      id: "question-1",
      sessionID: "session-1",
      questions: [
        {
          question: "What should we run?",
          header: "Action",
          options: [{ label: "Tests", description: "Run tests" }],
        },
      ],
    };

    const { container } = render(<QuestionPrompt onReject={vi.fn()} onReply={vi.fn()} request={request} />);

    expect(screen.getByText("Action")).toBeInTheDocument();
    expect(screen.getByText("What should we run?")).toBeInTheDocument();
    expect(container.querySelectorAll(".rounded-full.border-2.border-black").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /collapse question details/i }));

    expect(screen.queryByText("What should we run?")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /expand question details/i })).toBeInTheDocument();
  });

  it("submits selected and custom answers", () => {
    const onReply = vi.fn();
    const request: OpencodeQuestionRequest = {
      id: "question-2",
      sessionID: "session-1",
      questions: [
        {
          question: "What should we run?",
          header: "Action",
          options: [{ label: "Tests", description: "Run tests" }],
        },
        {
          question: "Anything else?",
          header: "Notes",
          options: [{ label: "None", description: "No notes" }],
          multiple: true,
        },
      ],
    };

    render(<QuestionPrompt onReject={vi.fn()} onReply={onReply} request={request} />);

    fireEvent.click(screen.getByRole("button", { name: /tests/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /type your own answer/i })[1]!);
    fireEvent.change(screen.getByPlaceholderText("Type your answer..."), {
      target: { value: "Also lint" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));

    expect(onReply).toHaveBeenCalledWith("question-2", [["Tests"], ["Also lint"]]);
  });

  it("clears single-select answers when custom is enabled", () => {
    const onReply = vi.fn();
    const request: OpencodeQuestionRequest = {
      id: "question-4",
      sessionID: "session-1",
      questions: [
        {
          question: "What should we run?",
          header: "Action",
          options: [{ label: "Tests", description: "Run tests" }],
        },
      ],
    };

    render(<QuestionPrompt onReject={vi.fn()} onReply={onReply} request={request} />);

    fireEvent.click(screen.getByRole("button", { name: /tests/i }));
    fireEvent.click(screen.getByRole("button", { name: /type your own answer/i }));
    fireEvent.change(screen.getByPlaceholderText("Type your answer..."), {
      target: { value: "Also lint" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));

    expect(onReply).toHaveBeenCalledWith("question-4", [["Also lint"]]);
  });

  it("dismisses the question request", () => {
    const onReject = vi.fn();
    const request: OpencodeQuestionRequest = {
      id: "question-3",
      sessionID: "session-1",
      questions: [
        {
          question: "What should we run?",
          header: "Action",
          options: [{ label: "Tests", description: "Run tests" }],
        },
      ],
    };

    render(<QuestionPrompt onReject={onReject} onReply={vi.fn()} request={request} />);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss questions" }));

    expect(onReject).toHaveBeenCalledWith("question-3");
  });

  it("resets local answers when the request payload changes", () => {
    const onReply = vi.fn();
    const initial: OpencodeQuestionRequest = {
      id: "question-5",
      sessionID: "session-1",
      questions: [
        {
          question: "What should we run?",
          header: "Action",
          options: [{ label: "Tests", description: "Run tests" }],
        },
      ],
    };
    const updated: OpencodeQuestionRequest = {
      id: "question-5",
      sessionID: "session-1",
      questions: [
        {
          question: "What should we run now?",
          header: "Action",
          options: [{ label: "Build", description: "Run build" }],
        },
        {
          question: "Anything else?",
          header: "Notes",
          options: [{ label: "Lint", description: "Run lint" }],
        },
      ],
    };

    const view = render(<QuestionPrompt onReject={vi.fn()} onReply={onReply} request={initial} />);

    fireEvent.click(screen.getByRole("button", { name: /tests/i }));

    view.rerender(<QuestionPrompt onReject={vi.fn()} onReply={onReply} request={updated} />);

    fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));

    expect(onReply).toHaveBeenCalledWith("question-5", [[], []]);
    expect(screen.getByText("What should we run now?")).toBeInTheDocument();
  });
});
