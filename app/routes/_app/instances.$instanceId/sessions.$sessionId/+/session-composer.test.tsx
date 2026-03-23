import "fake-indexeddb/auto";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { clearStoredSessionComposerDraft, useSessionComposerDraft } from "./session-composer-draft";

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
});
