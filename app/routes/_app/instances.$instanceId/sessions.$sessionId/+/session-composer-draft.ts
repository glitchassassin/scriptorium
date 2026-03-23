import { useCallback, useEffect, useRef, useState } from "react";

type ComposerSelection = {
  start: number;
  end: number;
};

type StoredDraftAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
};

type StoredDraft = {
  attachments: StoredDraftAttachment[];
  selectedAgent: string | null;
  selection: ComposerSelection;
  text: string;
};

type StoredAttachmentRecord = StoredDraftAttachment & {
  blob: Blob;
  sessionId: string;
};

export type DraftImage = {
  file: File;
  id: string;
  preview: string;
};

type UseSessionComposerDraftOptions = {
  defaultAgent: string | null;
  prefilledPrompt: string;
  sessionId: string;
};

const SESSION_COMPOSER_DB_NAME = "scriptorium-session-composer";
const SESSION_COMPOSER_DB_VERSION = 1;
const SESSION_COMPOSER_ATTACHMENTS_STORE = "attachments";

const EMPTY_SELECTION: ComposerSelection = { start: 0, end: 0 };

function isImage(file: File) {
  return file.type.startsWith("image/");
}

function createAttachmentId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `image-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDraftImage(file: File, id: string): DraftImage {
  return {
    file,
    id,
    preview: URL.createObjectURL(file),
  };
}

function revokeDraftImages(images: DraftImage[]) {
  images.forEach((image) => URL.revokeObjectURL(image.preview));
}

export function getSessionComposerStorageKey(sessionId: string) {
  return `session-composer:${sessionId}`;
}

function getStoredDraftAttachment(image: DraftImage): StoredDraftAttachment {
  return {
    id: image.id,
    lastModified: image.file.lastModified,
    name: image.file.name,
    size: image.file.size,
    type: image.file.type,
  };
}

function readStoredDraft(sessionId: string): StoredDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(getSessionComposerStorageKey(sessionId));

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredDraft>;

    return {
      attachments: Array.isArray(parsed.attachments)
        ? parsed.attachments.filter((attachment): attachment is StoredDraftAttachment =>
          Boolean(
            attachment
            && typeof attachment.id === "string"
            && typeof attachment.name === "string"
            && typeof attachment.type === "string"
            && typeof attachment.size === "number"
            && typeof attachment.lastModified === "number",
          ),
        )
        : [],
      selectedAgent: typeof parsed.selectedAgent === "string" ? parsed.selectedAgent : null,
      selection: parsed.selection && typeof parsed.selection.start === "number" && typeof parsed.selection.end === "number"
        ? parsed.selection
        : EMPTY_SELECTION,
      text: typeof parsed.text === "string" ? parsed.text : "",
    };
  } catch {
    return null;
  }
}

function writeStoredDraft(sessionId: string, draft: StoredDraft) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(getSessionComposerStorageKey(sessionId), JSON.stringify(draft));
}

async function openSessionComposerDatabase() {
  if (typeof indexedDB === "undefined") {
    return null;
  }

  return await new Promise<IDBDatabase | null>((resolve, reject) => {
    const request = indexedDB.open(SESSION_COMPOSER_DB_NAME, SESSION_COMPOSER_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(SESSION_COMPOSER_ATTACHMENTS_STORE)) {
        const store = database.createObjectStore(SESSION_COMPOSER_ATTACHMENTS_STORE, { keyPath: ["sessionId", "id"] });
        store.createIndex("sessionId", "sessionId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open session composer database."));
  });
}

function waitForRequest<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

async function withAttachmentStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => Promise<T>) {
  const database = await openSessionComposerDatabase();

  if (!database) {
    return null;
  }

  try {
    const transaction = database.transaction(SESSION_COMPOSER_ATTACHMENTS_STORE, mode);
    const store = transaction.objectStore(SESSION_COMPOSER_ATTACHMENTS_STORE);
    const result = await run(store);

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
    });

    return result;
  } finally {
    database.close();
  }
}

async function putStoredAttachment(record: StoredAttachmentRecord) {
  await withAttachmentStore("readwrite", async (store) => {
    await waitForRequest(store.put(record));
    return null;
  });
}

async function getStoredAttachment(sessionId: string, attachmentId: string) {
  const record = await withAttachmentStore("readonly", async (store) => {
    return await waitForRequest(store.get([sessionId, attachmentId]));
  });

  return record as StoredAttachmentRecord | null;
}

async function deleteStoredAttachment(sessionId: string, attachmentId: string) {
  await withAttachmentStore("readwrite", async (store) => {
    await waitForRequest(store.delete([sessionId, attachmentId]));
    return null;
  });
}

export async function clearStoredSessionComposerDraft(sessionId: string) {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(getSessionComposerStorageKey(sessionId));
  }

  await withAttachmentStore("readwrite", async (store) => {
    const index = store.index("sessionId");
    const records = await waitForRequest(index.getAll(IDBKeyRange.only(sessionId)));

    await Promise.all(records.map((record) => waitForRequest(store.delete([sessionId, record.id]))));
    return null;
  });
}

async function loadStoredImages(sessionId: string, attachments: StoredDraftAttachment[]) {
  const restored = await Promise.all(attachments.map(async (attachment) => {
    const record = await getStoredAttachment(sessionId, attachment.id);

    if (!record) {
      return null;
    }

    const file = new File([record.blob], record.name, {
      lastModified: record.lastModified,
      type: record.type,
    });

    return createDraftImage(file, record.id);
  }));

  return restored.filter((image): image is DraftImage => image !== null);
}

export function useSessionComposerDraft({ defaultAgent, prefilledPrompt, sessionId }: UseSessionComposerDraftOptions) {
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef<ComposerSelection>(EMPTY_SELECTION);
  const imagesRef = useRef<DraftImage[]>([]);
  const hydratedRef = useRef(false);
  const restoreIdRef = useRef(0);
  const focusAfterRestoreRef = useRef(false);

  const [composerText, setComposerText] = useState("");
  const [images, setImages] = useState<DraftImage[]>([]);
  const [isRestoringAttachments, setIsRestoringAttachments] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(defaultAgent);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(
    () => () => {
      revokeDraftImages(imagesRef.current);
    },
    [],
  );

  useEffect(() => {
    const restoreId = restoreIdRef.current + 1;
    restoreIdRef.current = restoreId;
    hydratedRef.current = false;
    focusAfterRestoreRef.current = false;

    revokeDraftImages(imagesRef.current);
    imagesRef.current = [];
    setImages([]);
    setIsRestoringAttachments(true);

    const storedDraft = readStoredDraft(sessionId);
    const nextText = storedDraft?.text ?? prefilledPrompt;
    const nextSelection = storedDraft?.selection ?? { start: nextText.length, end: nextText.length };
    const nextAgent = storedDraft?.selectedAgent ?? defaultAgent;

    selectionRef.current = nextSelection;
    setComposerText(nextText);
    setSelectedAgent(nextAgent);
    focusAfterRestoreRef.current = !storedDraft?.text && Boolean(prefilledPrompt);

    void loadStoredImages(sessionId, storedDraft?.attachments ?? []).then((restoredImages) => {
      if (restoreIdRef.current !== restoreId) {
        revokeDraftImages(restoredImages);
        return;
      }

      imagesRef.current = restoredImages;
      setImages(restoredImages);
      hydratedRef.current = true;
      setIsRestoringAttachments(false);
    });
  }, [defaultAgent, prefilledPrompt, sessionId]);

  useEffect(() => {
    if (!focusAfterRestoreRef.current) {
      return;
    }

    focusAfterRestoreRef.current = false;

    window.requestAnimationFrame(() => {
      const input = composerInputRef.current;

      if (!input) {
        return;
      }

      const caret = selectionRef.current.end;
      input.focus();
      input.setSelectionRange(caret, caret);
    });
  }, [composerText]);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }

    writeStoredDraft(sessionId, {
      attachments: images.map(getStoredDraftAttachment),
      selectedAgent,
      selection: selectionRef.current,
      text: composerText,
    });
  }, [composerText, images, selectedAgent, sessionId]);

  const updateComposerSelection = useCallback((target?: HTMLTextAreaElement | null) => {
    const input = target ?? composerInputRef.current;

    if (!input) {
      return;
    }

    selectionRef.current = {
      start: input.selectionStart ?? 0,
      end: input.selectionEnd ?? input.selectionStart ?? 0,
    };

    if (hydratedRef.current) {
      writeStoredDraft(sessionId, {
        attachments: imagesRef.current.map(getStoredDraftAttachment),
        selectedAgent,
        selection: selectionRef.current,
        text: input.value,
      });
    }
  }, [selectedAgent, sessionId]);

  const insertComposerReference = useCallback((reference: string) => {
    let nextSelectionStart = 0;
    let nextSelectionEnd = 0;

    setComposerText((current) => {
      const maxIndex = current.length;
      const rawStart = selectionRef.current.start;
      const rawEnd = selectionRef.current.end;
      const start = Math.max(0, Math.min(rawStart, maxIndex));
      const end = Math.max(start, Math.min(rawEnd, maxIndex));
      const prefix = start > 0 && /\S/.test(current[start - 1] ?? "") ? " " : "";
      const suffix = end === current.length || /\S/.test(current[end] ?? "") ? " " : "";
      const insertion = `${prefix}${reference}${suffix}`;
      const next = `${current.slice(0, start)}${insertion}${current.slice(end)}`;
      const caret = start + insertion.length;

      nextSelectionStart = caret;
      nextSelectionEnd = caret;
      selectionRef.current = { start: caret, end: caret };
      return next;
    });

    window.requestAnimationFrame(() => {
      const input = composerInputRef.current;

      if (!input) {
        return;
      }

      input.focus();
      input.setSelectionRange(nextSelectionStart, nextSelectionEnd);
      selectionRef.current = { start: nextSelectionStart, end: nextSelectionEnd };
    });
  }, []);

  const addImages = useCallback(async (items: FileList | File[]) => {
    const files = Array.from(items).filter(isImage);

    if (files.length === 0) {
      return;
    }

    const nextImages = await Promise.all(files.map(async (file) => {
      const id = createAttachmentId();

      await putStoredAttachment({
        blob: file,
        id,
        lastModified: file.lastModified,
        name: file.name,
        sessionId,
        size: file.size,
        type: file.type,
      });

      return createDraftImage(file, id);
    }));

    setImages((current) => [...current, ...nextImages]);
  }, [sessionId]);

  const removeImage = useCallback(async (id: string) => {
    let removedImage: DraftImage | undefined;

    setImages((current) => {
      removedImage = current.find((image) => image.id === id);
      return current.filter((image) => image.id !== id);
    });

    if (removedImage) {
      URL.revokeObjectURL(removedImage.preview);
    }

    await deleteStoredAttachment(sessionId, id);
  }, [sessionId]);

  const clearDraftContent = useCallback(async () => {
    revokeDraftImages(imagesRef.current);
    imagesRef.current = [];
    setImages([]);
    setComposerText("");
    selectionRef.current = EMPTY_SELECTION;

    await clearStoredSessionComposerDraft(sessionId);

    if (selectedAgent || hydratedRef.current) {
      writeStoredDraft(sessionId, {
        attachments: [],
        selectedAgent,
        selection: EMPTY_SELECTION,
        text: "",
      });
    }
  }, [selectedAgent, sessionId]);

  return {
    addImages,
    clearDraftContent,
    composerInputRef,
    composerText,
    imageInputRef,
    images,
    insertComposerReference,
    isRestoringAttachments,
    removeImage,
    selectedAgent,
    setComposerText,
    setSelectedAgent,
    updateComposerSelection,
  };
}
