import "fake-indexeddb/auto";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

function ComposerDraftHarness({ defaultAgent = "draft", prefilledPrompt = "", sessionId }: { defaultAgent?: string | null; prefilledPrompt?: string; sessionId: string }) {
  const draft = useSessionComposerDraft({ defaultAgent, prefilledPrompt, sessionId });

  return (
    <div>
      <div data-testid="restoring">{String(draft.isRestoringAttachments)}</div>
      <div data-testid="selected-agent">{draft.selectedAgent ?? ""}</div>
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
        defaultAgent="draft"
        insertReferenceEvents={new EventTarget()}
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
        defaultAgent="draft"
        insertReferenceEvents={new EventTarget()}
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

  it("submits the review button through the shared fetcher", async () => {
    render(
      <SessionComposer
        agents={["draft", "review"]}
        defaultAgent="draft"
        insertReferenceEvents={new EventTarget()}
        isBusy={false}
        onClearSessionError={() => {}}
        prefilledPrompt=""
        sessionError={null}
        sessionId="session-component"
      />,
    );

    await waitFor(() => expect(screen.queryByText("Restoring attachments...")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Start review" }));

    await waitFor(() => expect(commandFetcher.submit).toHaveBeenCalledTimes(1));
    expect(getSubmittedFormData(commandFetcher).get("intent")).toBe("command");
    expect(getSubmittedFormData(commandFetcher).get("agent")).toBe("draft");
    expect(getSubmittedFormData(commandFetcher).get("arguments")).toBe("");
    expect(getSubmittedFormData(commandFetcher).get("clearDraft")).toBe("0");
    expect(getSubmittedFormData(commandFetcher).get("command")).toBe("review");
  });

  it("does not use composer text when starting review", async () => {
    render(
      <SessionComposer
        agents={["draft", "review"]}
        defaultAgent="draft"
        insertReferenceEvents={new EventTarget()}
        isBusy={false}
        onClearSessionError={() => {}}
        prefilledPrompt=""
        sessionError={null}
        sessionId="session-component"
      />,
    );

    await waitFor(() => expect(screen.queryByText("Restoring attachments...")).not.toBeInTheDocument());

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Ignore me" } });
    fireEvent.click(screen.getByRole("button", { name: "Start review" }));

    await waitFor(() => expect(commandFetcher.submit).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("textbox")).toHaveValue("Ignore me");
  });

  it("keeps attach and send enabled while a command is pending", async () => {
    commandFetcher.state = "submitting";

    render(
      <SessionComposer
        agents={["draft", "review"]}
        defaultAgent="draft"
        insertReferenceEvents={new EventTarget()}
        isBusy={false}
        onClearSessionError={() => {}}
        prefilledPrompt=""
        sessionError={null}
        sessionId="session-component"
      />,
    );

    await waitFor(() => expect(screen.queryByText("Restoring attachments...")).not.toBeInTheDocument());

    expect(screen.getByRole("button", { name: "Start review" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Attach image" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Send message" })).toBeEnabled();
  });

  it("keeps review enabled while a prompt submission is pending", async () => {
    promptFetcher.state = "submitting";

    render(
      <SessionComposer
        agents={["draft", "review"]}
        defaultAgent="draft"
        insertReferenceEvents={new EventTarget()}
        isBusy={false}
        onClearSessionError={() => {}}
        prefilledPrompt=""
        sessionError={null}
        sessionId="session-component"
      />,
    );

    await waitFor(() => expect(screen.queryByText("Restoring attachments...")).not.toBeInTheDocument());

    expect(screen.getByRole("button", { name: "Start review" })).toBeEnabled();
  });

  it("submits slash commands from the composer through the shared fetcher", async () => {
    render(
      <SessionComposer
        agents={["draft", "review"]}
        defaultAgent="draft"
        insertReferenceEvents={new EventTarget()}
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

    await waitFor(() => expect(promptFetcher.submit).toHaveBeenCalledTimes(1));
    expect(getSubmittedFormData(promptFetcher).get("intent")).toBe("prompt");
    expect(getSubmittedFormData(promptFetcher).get("text")).toBe("/review feature-branch");
  });

  it("disables review while the session is busy", async () => {
    render(
      <SessionComposer
        agents={["draft", "review"]}
        defaultAgent="draft"
        insertReferenceEvents={new EventTarget()}
        isBusy={true}
        onClearSessionError={() => {}}
        prefilledPrompt=""
        sessionError={null}
        sessionId="session-component"
      />,
    );

    await waitFor(() => expect(screen.queryByText("Restoring attachments...")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Start review" })).toBeDisabled();
  });
});
