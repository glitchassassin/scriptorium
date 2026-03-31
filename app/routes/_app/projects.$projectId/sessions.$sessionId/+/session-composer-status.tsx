type SessionComposerStatusProps = {
  abortError: string | null;
  commandError: string | null;
  isRestoringAttachments: boolean;
  promptError: string | null;
  sessionError: string | null;
};

export function SessionComposerStatus({
  abortError,
  commandError,
  isRestoringAttachments,
  promptError,
  sessionError,
}: SessionComposerStatusProps) {
  return (
    <div className="space-y-3">
      {promptError ? <p className="text-base leading-6">{promptError}</p> : null}
      {commandError ? <p className="text-base leading-6">{commandError}</p> : null}
      {abortError ? <p className="text-base leading-6">{abortError}</p> : null}
      {sessionError ? <p className="text-base leading-6">{sessionError}</p> : null}
      {isRestoringAttachments ? <p className="text-sm leading-6">Restoring attachments...</p> : null}
    </div>
  );
}
