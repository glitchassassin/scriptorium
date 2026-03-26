import { QuestionPrompt } from "~/components/session/question-prompt";
import type { OpencodeQuestionAnswer, OpencodeQuestionRequest } from "~/lib/opencode/events";

type QuestionCardProps = {
  onReject: (requestId: string) => void;
  onReply: (requestId: string, answers: OpencodeQuestionAnswer[]) => void;
  questions: OpencodeQuestionRequest[];
};

export function QuestionCard({ onReject, onReply, questions }: QuestionCardProps) {
  if (!questions.length) {
    return null;
  }

  return (
    <article className="flex justify-start">
      <div className="w-full space-y-3 px-3 py-3 text-left">
        <div className="flex items-baseline gap-3 justify-start">
          <p className="text-sm uppercase tracking-[0.08em]">Answer Questions</p>
        </div>
        <div className="space-y-1">
          {questions.map((question, index) => (
            <div
              className={index > 0 ? "border-t-2 border-black pt-3" : ""}
              key={question.id}
            >
              <QuestionPrompt onReject={onReject} onReply={onReply} request={question} />
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
