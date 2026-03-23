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
  abortFetcher.data = undefined;
  abortFetcher.state = "idle";
  abortFetcher.submit.mockReset();
});

beforeEach(() => {
  let fetcherIndex = 0;
  useFetcherMock.mockImplementation(() => {
    const fetcher = fetcherIndex % 2 === 0 ? promptFetcher : abortFetcher;
    fetcherIndex += 1;
    return fetcher;
  });
});

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

    promptFetcher.data = { intent: "prompt", ok: true };
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
});
