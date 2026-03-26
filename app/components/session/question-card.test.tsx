import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QuestionCard } from "~/components/session/question-card";
import type { OpencodeQuestionRequest } from "~/lib/opencode/events";

describe("QuestionCard", () => {
  it("renders grouped question requests", () => {
    const questions: OpencodeQuestionRequest[] = [
      {
        id: "question-1",
        sessionID: "session-1",
        questions: [
          {
            question: "What should we run?",
            header: "Action",
            options: [{ label: "Tests", description: "Run tests" }],
          },
        ],
      },
      {
        id: "question-2",
        sessionID: "session-1",
        questions: [
          {
            question: "How urgent is it?",
            header: "Priority",
            options: [{ label: "High", description: "Right away" }],
          },
        ],
      },
    ];

    const { container } = render(
      <QuestionCard onReject={vi.fn()} onReply={vi.fn()} questions={questions} />,
    );

    expect(screen.getByText("Answer Questions")).toBeInTheDocument();
    expect(screen.getByText("Action")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(container.querySelectorAll(".border-t-2.border-black")).toHaveLength(1);
  });

  it("renders nothing when no questions are pending", () => {
    const { container } = render(
      <QuestionCard onReject={vi.fn()} onReply={vi.fn()} questions={[]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
