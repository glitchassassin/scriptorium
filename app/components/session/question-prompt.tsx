import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";

import type { OpencodeQuestionAnswer, OpencodeQuestionRequest } from "~/lib/opencode/events";

type QuestionPromptProps = {
  onReject: (requestId: string) => void;
  onReply: (requestId: string, answers: OpencodeQuestionAnswer[]) => void;
  request: OpencodeQuestionRequest;
};

function allowsCustom(request: OpencodeQuestionRequest, index: number) {
  return request.questions[index]?.custom !== false;
}

function getTitle(request: OpencodeQuestionRequest) {
  if (request.questions.length === 1) {
    return request.questions[0]?.header || "Question";
  }

  return `${request.questions.length} questions`;
}

function Selector({ multiple, picked }: { multiple: boolean; picked: boolean }) {
  return (
    <span
      className={multiple
        ? "inline-flex min-h-6 min-w-6 items-center justify-center border-2 border-black text-xs"
        : "inline-flex min-h-6 min-w-6 items-center justify-center rounded-full border-2 border-black text-xs"}
    >
      {picked ? (
        multiple ? <Icon className="size-4" icon="mdi:check" /> : <span className="size-2 rounded-full bg-black" />
      ) : null}
    </span>
  );
}

export function QuestionPrompt({ onReject, onReply, request }: QuestionPromptProps) {
  const [expanded, setExpanded] = useState(true);
  const [answers, setAnswers] = useState<OpencodeQuestionAnswer[]>(() => request.questions.map(() => []));
  const [customEnabled, setCustomEnabled] = useState<boolean[]>(() => request.questions.map(() => false));
  const [customValues, setCustomValues] = useState<string[]>(() => request.questions.map(() => ""));
  const title = useMemo(() => getTitle(request), [request]);

  useEffect(() => {
    setAnswers(request.questions.map(() => []));
    setCustomEnabled(request.questions.map(() => false));
    setCustomValues(request.questions.map(() => ""));
  }, [request]);

  function updateCustom(index: number, value: string) {
    setCustomValues((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
    setAnswers((current) => {
      const next = current.map((item) => [...item]);
      const question = request.questions[index];
      const trimmed = value.trim();

      if (!question) {
        return next;
      }

      if (!customEnabled[index]) {
        return next;
      }

      if (question.multiple) {
        const previous = customValues[index]?.trim();
        next[index] = previous ? next[index]?.filter((item) => item !== previous) ?? [] : next[index] ?? [];

        if (trimmed) {
          next[index] = [...(next[index] ?? []), trimmed];
        }

        return next;
      }

      next[index] = trimmed ? [trimmed] : [];
      return next;
    });
  }

  function toggleCustom(index: number) {
    setCustomEnabled((current) => current.map((item, itemIndex) => (itemIndex === index ? !item : item)));
    setAnswers((current) => {
      const next = current.map((item) => [...item]);
      const question = request.questions[index];
      const value = customValues[index]?.trim();

      if (!question) {
        return next;
      }

      if (customEnabled[index]) {
        if (question.multiple && value) {
          next[index] = next[index]?.filter((item) => item !== value) ?? [];
          return next;
        }

        next[index] = [];
        return next;
      }

      if (!value) {
        if (!question.multiple) {
          next[index] = [];
        }
        return next;
      }

      if (question.multiple) {
        next[index] = [...(next[index] ?? []), value];
        return next;
      }

      next[index] = [value];
      return next;
    });
  }

  function pickOption(index: number, label: string) {
    setAnswers((current) => {
      const next = current.map((item) => [...item]);
      const question = request.questions[index];

      if (!question) {
        return next;
      }

      if (!question.multiple) {
        next[index] = [label];
        setCustomEnabled((customCurrent) =>
          customCurrent.map((item, itemIndex) => (itemIndex === index ? false : item)),
        );
        return next;
      }

      next[index] = next[index]?.includes(label)
        ? next[index]!.filter((item) => item !== label)
        : [...(next[index] ?? []), label];
      return next;
    });
  }

  return (
    <div className="space-y-4 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-2">
        <button
          aria-label={expanded ? "Collapse question details" : "Expand question details"}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          <Icon className="size-5" icon={expanded ? "mdi:unfold-less-horizontal" : "mdi:unfold-more-horizontal"} />
        </button>
        <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
          <p className="pt-2 text-sm leading-6 font-bold break-words">{title}</p>
        </div>
      </div>
      {expanded ? (
        <div className="space-y-6">
          {request.questions.map((question, index) => {
            const selected = answers[index] ?? [];
            const customAllowed = allowsCustom(request, index);
            const customOn = customEnabled[index] === true;
            const customValue = customValues[index] ?? "";

            return (
              <fieldset className="space-y-3" key={`${request.id}:${index}`}>
                <legend className="text-sm leading-6 font-bold">{question.question}</legend>
                <div className="space-y-2">
                  {question.options.map((option) => {
                    const picked = selected.includes(option.label);

                    return (
                      <button
                        className="flex w-full items-start gap-3 px-3 py-3 text-left"
                        data-picked={picked ? "true" : undefined}
                        key={option.label}
                        onClick={() => pickOption(index, option.label)}
                        type="button"
                      >
                        <Selector multiple={question.multiple === true} picked={picked} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm leading-6 font-bold">{option.label}</span>
                          <span className="block text-sm leading-6 opacity-80">{option.description}</span>
                        </span>
                      </button>
                    );
                  })}
                  {customAllowed ? (
                    <div className="space-y-2 px-3 py-3">
                      <button
                        className="flex w-full items-start gap-3 text-left"
                        data-picked={customOn ? "true" : undefined}
                        onClick={() => toggleCustom(index)}
                        type="button"
                      >
                        <Selector multiple={question.multiple === true} picked={customOn} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm leading-6 font-bold">Type your own answer</span>
                          <span className="block text-sm leading-6 opacity-80">
                            {customValue || "Type your answer..."}
                          </span>
                        </span>
                      </button>
                      {customOn ? (
                        <div className="pl-9">
                          <textarea
                            className="min-h-24 w-full border-2 border-black px-3 py-2 text-sm leading-6"
                            onChange={(event) => updateCustom(index, event.target.value)}
                            placeholder="Type your answer..."
                            value={customValue}
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </fieldset>
            );
          })}
          <div className="flex items-center justify-end gap-1 pt-2">
            <button
              aria-label="Dismiss questions"
              className="inline-flex min-h-11 min-w-11 items-center justify-center"
              onClick={() => onReject(request.id)}
              type="button"
            >
              <Icon className="size-5" icon="mdi:close-box" />
            </button>
            <button
              aria-label="Submit answers"
              className="inline-flex min-h-11 min-w-11 items-center justify-center"
              onClick={() => onReply(request.id, answers)}
              type="button"
            >
              <Icon className="size-5" icon="mdi:send" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
