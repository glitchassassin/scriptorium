import "fake-indexeddb/auto";

import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OpencodeProvider } from "~/lib/opencode/events";

const useFetcherMock = vi.fn();

vi.mock("react-router", () => ({
  useFetcher: () => useFetcherMock(),
}));

vi.mock("@iconify/react", () => ({
  Icon: () => null,
}));

vi.mock("@iconify-json/mdi", () => ({}));

import { SessionComposer } from "./session-composer";
import { clearStoredSessionComposerDraft, useSessionComposerDraft } from "./session-composer-draft";

type MockFetcher = {
  data: unknown;
  state: "idle" | "loading" | "submitting";
  submit: ReturnType<typeof vi.fn>;
};

const promptFetcher: MockFetcher = {
  data: undefined,
  state: "idle",
  submit: vi.fn(),
};

const commandFetcher: MockFetcher = {
  data: undefined,
  state: "idle",
  submit: vi.fn(),
};

const abortFetcher: MockFetcher = {
  data: undefined,
  state: "idle",
  submit: vi.fn(),
};

const DEFAULT_COMMANDS = [
  { description: "Review changes [commit|branch|pr], defaults to uncommitted", name: "review" },
];

const DEFAULT_MODEL = { modelID: "gpt-5", providerID: "openai" };
const DEFAULT_PROVIDERS: OpencodeProvider[] = [
  {
    id: "openai",
    models: {
      "gpt-5": {
        id: "gpt-5",
        name: "GPT 5",
        variants: {
          high: {},
          low: {},
        },
      },
      "gpt-5-mini": {
        id: "gpt-5-mini",
        name: "GPT 5 Mini",
      },
    },
    name: "OpenAI",
  },
  {
    id: "anthropic",
    models: {
      "claude-sonnet": {
        id: "claude-sonnet",
        name: "Claude Sonnet",
        variants: {
          high: {},
        },
      },
    },
    name: "Anthropic",
  },
];

function renderSessionComposer(props?: Partial<ComponentProps<typeof SessionComposer>>) {
  return render(
    <SessionComposer
      agents={["draft", "review"]}
      commands={DEFAULT_COMMANDS}
      defaultAgent="draft"
      defaultModel={DEFAULT_MODEL}
      defaultVariant={null}
      insertReferenceEvents={new EventTarget()}
      isBusy={false}
      onClearSessionError={() => {}}
      prefilledPrompt=""
      providers={DEFAULT_PROVIDERS}
      sessionError={null}
      sessionId="session-component"
      {...props}
    />,
  );
}

function ComposerDraftHarness({
  defaultAgent = "draft",
  defaultModel = DEFAULT_MODEL,
  defaultVariant = null,
  prefilledPrompt = "",
  sessionId,
}: {
  defaultAgent?: string | null;
  defaultModel?: typeof DEFAULT_MODEL | null;
  defaultVariant?: string | null;
  prefilledPrompt?: string;
  sessionId: string;
}) {
  const draft = useSessionComposerDraft({ defaultAgent, defaultModel, defaultVariant, prefilledPrompt, sessionId });

  return (
    <div>
      <div data-testid="restoring">{String(draft.isRestoringAttachments)}</div>
      <div data-testid="selected-agent">{draft.selectedAgent ?? ""}</div>
      <div data-testid="selected-model">{draft.selectedModel ? `${draft.selectedModel.providerID}/${draft.selectedModel.modelID}` : ""}</div>
      <div data-testid="selected-variant">{draft.selectedVariant ?? ""}</div>
      <textarea
        aria-label="Composer"
        onChange={(event) => {
          draft.setComposerText(event.currentTarget.value);
          draft.updateComposerSelection(event.currentTarget);
        }}
        ref={draft.composerInputRef}
        value={draft.composerText}
      />
      <button onClick={() => draft.setSelectedAgent("review")} type="button">
        Set review
      </button>
      <button onClick={() => draft.setSelectedModel({ modelID: "claude-sonnet", providerID: "anthropic" })} type="button">
        Set Claude
      </button>
      <button onClick={() => draft.setSelectedVariant("high")} type="button">
        Set high
      </button>
      <button onClick={() => void draft.addImages([new File(["image"], "diagram.png", { type: "image/png" })])} type="button">
        Add image
      </button>
      <button onClick={() => void draft.clearDraftContent()} type="button">
        Clear draft
      </button>
      {draft.images.map((image) => <img alt={image.file.name} key={image.id} src={image.preview} />)}
    </div>
  );
}

async function waitForRestore() {
  await waitFor(() => expect(screen.getByTestId("restoring")).toHaveTextContent("false"));
}

afterEach(() => {
  window.sessionStorage.clear();
  promptFetcher.data = undefined;
  promptFetcher.state = "idle";
  promptFetcher.submit.mockReset();
  commandFetcher.data = undefined;
  commandFetcher.state = "idle";
  commandFetcher.submit.mockReset();
  abortFetcher.data = undefined;
  abortFetcher.state = "idle";
  abortFetcher.submit.mockReset();
});

beforeEach(() => {
  let fetcherIndex = 0;
  useFetcherMock.mockImplementation(() => {
    const fetcher = [promptFetcher, commandFetcher, abortFetcher][fetcherIndex % 3] ?? abortFetcher;
    fetcherIndex += 1;
    return fetcher;
  });
});

function getSubmittedFormData(fetcher: MockFetcher, index = 0) {
  const call = fetcher.submit.mock.calls[index];
  return call?.[0] as FormData;
}

function getImageInput(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]');

  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Expected image input");
  }

  return input;
}

describe("useSessionComposerDraft", () => {
  it("restores persisted text, agent, and attachments after remount", async () => {
    const sessionId = "session-persist";
    const firstRender = render(<ComposerDraftHarness sessionId={sessionId} />);

    await waitForRestore();
    fireEvent.change(screen.getByLabelText("Composer"), { target: { value: "Draft message" } });
    fireEvent.click(screen.getByRole("button", { name: "Set review" }));
    fireEvent.click(screen.getByRole("button", { name: "Add image" }));
    await screen.findByAltText("diagram.png");

    firstRender.unmount();

    render(<ComposerDraftHarness sessionId={sessionId} />);

    await waitForRestore();
    expect(screen.getByLabelText("Composer")).toHaveValue("Draft message");
    expect(screen.getByTestId("selected-agent")).toHaveTextContent("review");
    expect(screen.getByAltText("diagram.png")).toBeInTheDocument();

    await clearStoredSessionComposerDraft(sessionId);
  });

  it("restores persisted model and variant after remount", async () => {
    const sessionId = "session-model-persist";
    const firstRender = render(<ComposerDraftHarness sessionId={sessionId} />);

    await waitForRestore();
    fireEvent.click(screen.getByRole("button", { name: "Set Claude" }));
    fireEvent.click(screen.getByRole("button", { name: "Set high" }));

    firstRender.unmount();

    render(<ComposerDraftHarness sessionId={sessionId} />);

    await waitForRestore();
    expect(screen.getByTestId("selected-model")).toHaveTextContent("anthropic/claude-sonnet");
    expect(screen.getByTestId("selected-variant")).toHaveTextContent("high");

    await clearStoredSessionComposerDraft(sessionId);
  });

  it("keeps drafts isolated by session id", async () => {
    const view = render(<ComposerDraftHarness sessionId="session-a" />);

    await waitForRestore();
    fireEvent.change(screen.getByLabelText("Composer"), { target: { value: "Alpha" } });

    view.rerender(<ComposerDraftHarness sessionId="session-b" prefilledPrompt="Beta" />);
    await waitForRestore();
    expect(screen.getByLabelText("Composer")).toHaveValue("Beta");

    fireEvent.change(screen.getByLabelText("Composer"), { target: { value: "Beta updated" } });

    view.rerender(<ComposerDraftHarness sessionId="session-a" />);
    await waitForRestore();
    expect(screen.getByLabelText("Composer")).toHaveValue("Alpha");

    await Promise.all([clearStoredSessionComposerDraft("session-a"), clearStoredSessionComposerDraft("session-b")]);
  });

  it("clears persisted draft content after reset", async () => {
    const sessionId = "session-clear";
    const firstRender = render(<ComposerDraftHarness sessionId={sessionId} />);

    await waitForRestore();
    fireEvent.change(screen.getByLabelText("Composer"), { target: { value: "To be cleared" } });
    fireEvent.click(screen.getByRole("button", { name: "Add image" }));
    await screen.findByAltText("diagram.png");
    fireEvent.click(screen.getByRole("button", { name: "Clear draft" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Composer")).toHaveValue("");
      expect(screen.queryByAltText("diagram.png")).not.toBeInTheDocument();
    });

    firstRender.unmount();

    render(<ComposerDraftHarness sessionId={sessionId} />);
    await waitForRestore();
    expect(screen.getByLabelText("Composer")).toHaveValue("");
    expect(screen.queryByAltText("diagram.png")).not.toBeInTheDocument();

    await clearStoredSessionComposerDraft(sessionId);
  });

  it("does not clear a new draft when cycling agents after a successful prompt", async () => {
    const clearSessionError = vi.fn();
    const view = render(
      <SessionComposer
        agents={["draft", "review"]}
        commands={DEFAULT_COMMANDS}
        defaultAgent="draft"
        defaultModel={DEFAULT_MODEL}
        defaultVariant={null}
        insertReferenceEvents={new EventTarget()}
        providers={DEFAULT_PROVIDERS}
        isBusy={false}
        onClearSessionError={clearSessionError}
        prefilledPrompt=""
        sessionError={null}
        sessionId="session-component"
      />,
    );

    await waitFor(() => expect(screen.queryByText("Restoring attachments...")).not.toBeInTheDocument());

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "First prompt" } });

    promptFetcher.data = { clearDraft: true, intent: "prompt", ok: true };
    view.rerender(
      <SessionComposer
        agents={["draft", "review"]}
        commands={DEFAULT_COMMANDS}
        defaultAgent="draft"
        defaultModel={DEFAULT_MODEL}
        defaultVariant={null}
        insertReferenceEvents={new EventTarget()}
        providers={DEFAULT_PROVIDERS}
        isBusy={false}
        onClearSessionError={clearSessionError}
        prefilledPrompt=""
        sessionError={null}
        sessionId="session-component"
      />,
    );

    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue(""));
    expect(clearSessionError).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Second prompt" } });
    fireEvent.click(screen.getByRole("button", { name: "Cycle agent" }));

    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("Second prompt"));
    expect(clearSessionError).toHaveBeenCalledTimes(1);
  });

  it("replaces composer text when selecting a command from the tray", async () => {
    render(
      <SessionComposer
        agents={["draft", "review"]}
        commands={DEFAULT_COMMANDS}
        defaultAgent="draft"
        defaultModel={DEFAULT_MODEL}
        defaultVariant={null}
        insertReferenceEvents={new EventTarget()}
        providers={DEFAULT_PROVIDERS}
        isBusy={false}
        onClearSessionError={() => {}}
        prefilledPrompt=""
        sessionError={null}
        sessionId="session-component"
      />,
    );

    await waitFor(() => expect(screen.queryByText("Restoring attachments...")).not.toBeInTheDocument());

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Ignore me" } });
    fireEvent.click(screen.getByRole("button", { name: "Toggle commands tray" }));
    fireEvent.click(screen.getByRole("button", { name: "Insert /review" }));

    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("/review "));
  });

  it("shows the selected command description after inserting from the tray", async () => {
    render(
      <SessionComposer
        agents={["draft", "review"]}
        commands={DEFAULT_COMMANDS}
        defaultAgent="draft"
        defaultModel={DEFAULT_MODEL}
        defaultVariant={null}
        insertReferenceEvents={new EventTarget()}
        providers={DEFAULT_PROVIDERS}
        isBusy={false}
        onClearSessionError={() => {}}
        prefilledPrompt=""
        sessionError={null}
        sessionId="session-component"
      />,
    );

    await waitFor(() => expect(screen.queryByText("Restoring attachments...")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Toggle commands tray" }));
    fireEvent.click(screen.getByRole("button", { name: "Insert /review" }));

    expect(await screen.findByText("Review changes [commit|branch|pr], defaults to uncommitted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Insert /review" })).not.toBeInTheDocument();
  });

  it("keeps attach and send enabled while a command is pending", async () => {
    commandFetcher.state = "submitting";

    const view = render(
      <SessionComposer
        agents={["draft", "review"]}
        commands={DEFAULT_COMMANDS}
        defaultAgent="draft"
        defaultModel={DEFAULT_MODEL}
        defaultVariant={null}
        insertReferenceEvents={new EventTarget()}
        providers={DEFAULT_PROVIDERS}
        isBusy={false}
        onClearSessionError={() => {}}
        prefilledPrompt=""
        sessionError={null}
        sessionId="session-component"
      />,
    );

    await waitFor(() => expect(screen.queryByText("Restoring attachments...")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Toggle commands tray" }));

    expect(screen.getByRole("button", { name: "Insert /review" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Attach image" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Send message" })).toBeEnabled();
    expect(getImageInput(view.container)).toBeInTheDocument();
  });

  it("keeps command insertion enabled while a prompt submission is pending", async () => {
    promptFetcher.state = "submitting";

    render(
      <SessionComposer
        agents={["draft", "review"]}
        commands={DEFAULT_COMMANDS}
        defaultAgent="draft"
        defaultModel={DEFAULT_MODEL}
        defaultVariant={null}
        insertReferenceEvents={new EventTarget()}
        providers={DEFAULT_PROVIDERS}
        isBusy={false}
        onClearSessionError={() => {}}
        prefilledPrompt=""
        sessionError={null}
        sessionId="session-component"
      />,
    );

    await waitFor(() => expect(screen.queryByText("Restoring attachments...")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Toggle commands tray" }));

    expect(screen.getByRole("button", { name: "Insert /review" })).toBeEnabled();
  });

  it("submits slash commands from the composer through the shared fetcher", async () => {
    render(
      <SessionComposer
        agents={["draft", "review"]}
        commands={DEFAULT_COMMANDS}
        defaultAgent="draft"
        defaultModel={DEFAULT_MODEL}
        defaultVariant={null}
        insertReferenceEvents={new EventTarget()}
        providers={DEFAULT_PROVIDERS}
        isBusy={false}
        onClearSessionError={() => {}}
        prefilledPrompt=""
        sessionError={null}
        sessionId="session-component"
      />,
    );

    await waitFor(() => expect(screen.queryByText("Restoring attachments...")).not.toBeInTheDocument());

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "/review feature-branch" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(commandFetcher.submit).toHaveBeenCalledTimes(1));
    expect(getSubmittedFormData(commandFetcher).get("intent")).toBe("command");
    expect(getSubmittedFormData(commandFetcher).get("command")).toBe("review");
    expect(getSubmittedFormData(commandFetcher).get("arguments")).toBe("feature-branch");
    expect(getSubmittedFormData(commandFetcher).get("clearDraft")).toBe("1");
    expect(getSubmittedFormData(commandFetcher).get("modelProviderID")).toBe("openai");
    expect(getSubmittedFormData(commandFetcher).get("modelID")).toBe("gpt-5");
  });

  it("submits the selected model and variant with prompts", async () => {
    renderSessionComposer({ defaultVariant: "high" });

    await waitFor(() => expect(screen.queryByText("Restoring attachments...")).not.toBeInTheDocument());

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(promptFetcher.submit).toHaveBeenCalledTimes(1));
    expect(getSubmittedFormData(promptFetcher).get("modelProviderID")).toBe("openai");
    expect(getSubmittedFormData(promptFetcher).get("modelID")).toBe("gpt-5");
    expect(getSubmittedFormData(promptFetcher).get("variant")).toBe("high");
  });

  it("clears the textarea immediately after a slash-command submit", async () => {
    render(
      <SessionComposer
        agents={["draft", "review"]}
        commands={DEFAULT_COMMANDS}
        defaultAgent="draft"
        defaultModel={DEFAULT_MODEL}
        defaultVariant={null}
        insertReferenceEvents={new EventTarget()}
        providers={DEFAULT_PROVIDERS}
        isBusy={false}
        onClearSessionError={() => {}}
        prefilledPrompt=""
        sessionError={null}
        sessionId="session-component"
      />,
    );

    await waitFor(() => expect(screen.queryByText("Restoring attachments...")).not.toBeInTheDocument());

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "/review feature-branch" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue(""));
  });

  it("shows slash-command errors returned through the command fetcher", async () => {
    const view = render(
      <SessionComposer
        agents={["draft", "review"]}
        commands={DEFAULT_COMMANDS}
        defaultAgent="draft"
        defaultModel={DEFAULT_MODEL}
        defaultVariant={null}
        insertReferenceEvents={new EventTarget()}
        providers={DEFAULT_PROVIDERS}
        isBusy={false}
        onClearSessionError={() => {}}
        prefilledPrompt=""
        sessionError={null}
        sessionId="session-component"
      />,
    );

    await waitFor(() => expect(screen.queryByText("Restoring attachments...")).not.toBeInTheDocument());

    commandFetcher.data = { error: "Command failed", intent: "command" };
    view.rerender(
      <SessionComposer
        agents={["draft", "review"]}
        commands={DEFAULT_COMMANDS}
        defaultAgent="draft"
        defaultModel={DEFAULT_MODEL}
        defaultVariant={null}
        insertReferenceEvents={new EventTarget()}
        providers={DEFAULT_PROVIDERS}
        isBusy={false}
        onClearSessionError={() => {}}
        prefilledPrompt=""
        sessionError={null}
        sessionId="session-component"
      />,
    );

    expect(screen.getByText("Command failed")).toBeInTheDocument();
  });

  it("disables command insertion while the session is busy", async () => {
    render(
      <SessionComposer
        agents={["draft", "review"]}
        commands={DEFAULT_COMMANDS}
        defaultAgent="draft"
        defaultModel={DEFAULT_MODEL}
        defaultVariant={null}
        insertReferenceEvents={new EventTarget()}
        providers={DEFAULT_PROVIDERS}
        isBusy={true}
        onClearSessionError={() => {}}
        prefilledPrompt=""
        sessionError={null}
        sessionId="session-component"
      />,
    );

    await waitFor(() => expect(screen.queryByText("Restoring attachments...")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Toggle commands tray" }));
    expect(screen.getByRole("button", { name: "Insert /review" })).toBeDisabled();
  });

  it("highlights and toggles the commands tray button", async () => {
    render(
      <SessionComposer
        agents={["draft", "review"]}
        commands={DEFAULT_COMMANDS}
        defaultAgent="draft"
        defaultModel={DEFAULT_MODEL}
        defaultVariant={null}
        insertReferenceEvents={new EventTarget()}
        providers={DEFAULT_PROVIDERS}
        isBusy={false}
        onClearSessionError={() => {}}
        prefilledPrompt=""
        sessionError={null}
        sessionId="session-component"
      />,
    );

    await waitFor(() => expect(screen.queryByText("Restoring attachments...")).not.toBeInTheDocument());

    const commandsButton = screen.getByRole("button", { name: "Toggle commands tray" });
    expect(commandsButton).not.toHaveClass("bg-black");

    fireEvent.click(commandsButton);
    expect(commandsButton).toHaveClass("bg-black", "text-white");
    expect(screen.getByRole("button", { name: "Insert /review" })).toBeInTheDocument();

    fireEvent.click(commandsButton);
    expect(commandsButton).not.toHaveClass("bg-black");
    expect(screen.queryByRole("button", { name: "Insert /review" })).not.toBeInTheDocument();
  });

  it("shows the command description when the composer starts with a valid slash command", async () => {
    render(
      <SessionComposer
        agents={["draft", "review"]}
        commands={DEFAULT_COMMANDS}
        defaultAgent="draft"
        defaultModel={DEFAULT_MODEL}
        defaultVariant={null}
        insertReferenceEvents={new EventTarget()}
        providers={DEFAULT_PROVIDERS}
        isBusy={false}
        onClearSessionError={() => {}}
        prefilledPrompt=""
        sessionError={null}
        sessionId="session-component"
      />,
    );

    await waitFor(() => expect(screen.queryByText("Restoring attachments...")).not.toBeInTheDocument());

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "/review feature-branch" } });
    fireEvent.click(screen.getByRole("button", { name: "Toggle commands tray" }));

    expect(screen.getByText("Review changes [commit|branch|pr], defaults to uncommitted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Insert /review" })).not.toBeInTheDocument();
  });

  it("shows the command list when the composer has an invalid slash command", async () => {
    render(
      <SessionComposer
        agents={["draft", "review"]}
        commands={DEFAULT_COMMANDS}
        defaultAgent="draft"
        defaultModel={DEFAULT_MODEL}
        defaultVariant={null}
        insertReferenceEvents={new EventTarget()}
        providers={DEFAULT_PROVIDERS}
        isBusy={false}
        onClearSessionError={() => {}}
        prefilledPrompt=""
        sessionError={null}
        sessionId="session-component"
      />,
    );

    await waitFor(() => expect(screen.queryByText("Restoring attachments...")).not.toBeInTheDocument());

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "/unknown thing" } });
    fireEvent.click(screen.getByRole("button", { name: "Toggle commands tray" }));

    expect(screen.getByRole("button", { name: "Insert /review" })).toBeInTheDocument();
    expect(screen.queryByText("Review changes [commit|branch|pr], defaults to uncommitted")).not.toBeInTheDocument();
  });

  it("highlights and toggles the model tray button", async () => {
    render(
      <SessionComposer
        agents={["draft", "review"]}
        commands={DEFAULT_COMMANDS}
        defaultAgent="draft"
        defaultModel={DEFAULT_MODEL}
        defaultVariant={null}
        insertReferenceEvents={new EventTarget()}
        providers={DEFAULT_PROVIDERS}
        isBusy={false}
        onClearSessionError={() => {}}
        prefilledPrompt=""
        sessionError={null}
        sessionId="session-component"
      />,
    );

    await waitFor(() => expect(screen.queryByText("Restoring attachments...")).not.toBeInTheDocument());

    const modelButton = screen.getByRole("button", { name: "Toggle model tray" });
    expect(modelButton).not.toHaveClass("bg-black");

    fireEvent.click(modelButton);
    expect(modelButton).toHaveClass("bg-black", "text-white");
    expect(screen.getByRole("button", { name: "Use OpenAI GPT 5" })).toBeInTheDocument();

    fireEvent.click(modelButton);
    expect(modelButton).not.toHaveClass("bg-black");
    expect(screen.queryByRole("button", { name: "Use OpenAI GPT 5" })).not.toBeInTheDocument();
  });

  it("cycles variants inline from the button", async () => {
    renderSessionComposer();

    await waitFor(() => expect(screen.queryByText("Restoring attachments...")).not.toBeInTheDocument());

    const variantButton = screen.getByRole("button", { name: "Cycle variant" });
    expect(variantButton).toHaveTextContent("Auto");

    fireEvent.click(variantButton);
    expect(variantButton).toHaveTextContent("high");

    fireEvent.click(variantButton);
    expect(variantButton).toHaveTextContent("low");

    fireEvent.click(variantButton);
    expect(variantButton).toHaveTextContent("Auto");
  });

  it("lets provider sections collapse and expand in the model tray", async () => {
    renderSessionComposer();

    await waitFor(() => expect(screen.queryByText("Restoring attachments...")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Toggle model tray" }));
    expect(screen.getByRole("button", { name: "Use OpenAI GPT 5" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Toggle OpenAI models" }));
    expect(screen.queryByRole("button", { name: "Use OpenAI GPT 5" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Toggle OpenAI models" }));
    expect(screen.getByRole("button", { name: "Use OpenAI GPT 5" })).toBeInTheDocument();
  });

  it("shows images in the default tray and closes it when all images are removed", async () => {
    const view = render(
      <SessionComposer
        agents={["draft", "review"]}
        commands={DEFAULT_COMMANDS}
        defaultAgent="draft"
        defaultModel={DEFAULT_MODEL}
        defaultVariant={null}
        insertReferenceEvents={new EventTarget()}
        providers={DEFAULT_PROVIDERS}
        isBusy={false}
        onClearSessionError={() => {}}
        prefilledPrompt=""
        sessionError={null}
        sessionId="session-component"
      />,
    );

    await waitFor(() => expect(screen.queryByText("Restoring attachments...")).not.toBeInTheDocument());

    fireEvent.change(getImageInput(view.container), {
      target: {
        files: [new File(["image"], "diagram.png", { type: "image/png" })],
      },
    });

    expect(await screen.findByAltText("diagram.png")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Insert /review" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove diagram.png" }));

    await waitFor(() => expect(screen.queryByAltText("diagram.png")).not.toBeInTheDocument());
  });

  it("keeps the image tray behind explicit trays", async () => {
    const view = render(
      <SessionComposer
        agents={["draft", "review"]}
        commands={DEFAULT_COMMANDS}
        defaultAgent="draft"
        defaultModel={DEFAULT_MODEL}
        defaultVariant={null}
        insertReferenceEvents={new EventTarget()}
        providers={DEFAULT_PROVIDERS}
        isBusy={false}
        onClearSessionError={() => {}}
        prefilledPrompt=""
        sessionError={null}
        sessionId="session-component"
      />,
    );

    await waitFor(() => expect(screen.queryByText("Restoring attachments...")).not.toBeInTheDocument());

    fireEvent.change(getImageInput(view.container), {
      target: {
        files: [new File(["image"], "diagram.png", { type: "image/png" })],
      },
    });

    expect(await screen.findByAltText("diagram.png")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Toggle commands tray" }));

    expect(screen.getByRole("button", { name: "Insert /review" })).toBeInTheDocument();
    expect(screen.queryByAltText("diagram.png")).not.toBeInTheDocument();
  });

  it("resets explicit tray state when the session changes", async () => {
    const view = render(
      <SessionComposer
        agents={["draft", "review"]}
        commands={DEFAULT_COMMANDS}
        defaultAgent="draft"
        defaultModel={DEFAULT_MODEL}
        defaultVariant={null}
        insertReferenceEvents={new EventTarget()}
        providers={DEFAULT_PROVIDERS}
        isBusy={false}
        onClearSessionError={() => {}}
        prefilledPrompt=""
        sessionError={null}
        sessionId="session-a"
      />,
    );

    await waitFor(() => expect(screen.queryByText("Restoring attachments...")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Toggle commands tray" }));
    expect(screen.getByRole("button", { name: "Insert /review" })).toBeInTheDocument();

    view.rerender(
      <SessionComposer
        agents={["draft", "review"]}
        commands={DEFAULT_COMMANDS}
        defaultAgent="draft"
        defaultModel={DEFAULT_MODEL}
        defaultVariant={null}
        insertReferenceEvents={new EventTarget()}
        providers={DEFAULT_PROVIDERS}
        isBusy={false}
        onClearSessionError={() => {}}
        prefilledPrompt=""
        sessionError={null}
        sessionId="session-b"
      />,
    );

    await waitFor(() => expect(screen.queryByRole("button", { name: "Insert /review" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Toggle commands tray" })).not.toHaveClass("bg-black");
  });
});
