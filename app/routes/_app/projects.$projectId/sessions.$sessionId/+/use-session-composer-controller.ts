import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";

import { parseSlashCommand } from "~/lib/opencode/commands";
import type { OpencodeAgent, OpencodeCommandInfo, OpencodeModelRef, OpencodeProvider } from "~/lib/opencode/events";
import { getModelMetadata, getModelVariants, type SessionModelChoice } from "~/lib/opencode/models";
import { parseSubagentMention } from "~/lib/opencode/subagents";
import { useSessionComposerDraft } from "./session-composer-draft";
import type { ComposerTray, SessionComposerController, VisibleTray } from "./session-composer-types";

type UseSessionComposerControllerOptions = {
  agents: string[];
  commands: OpencodeCommandInfo[];
  defaultAgent: string | null;
  defaultModel: OpencodeModelRef | null;
  defaultVariant: string | null;
  insertReferenceEvents: EventTarget;
  onClearSessionError: () => void;
  prefilledPrompt: string;
  providers: OpencodeProvider[];
  recentModels: SessionModelChoice[];
  sessionId: string;
  subagents: OpencodeAgent[];
};

function getImageFiles(items: FileList | File[]) {
  return Array.from(items).filter((file) => file.type.startsWith("image/"));
}

export function useSessionComposerController({
  agents,
  commands,
  defaultAgent,
  defaultModel,
  defaultVariant,
  insertReferenceEvents,
  onClearSessionError,
  prefilledPrompt,
  providers,
  recentModels,
  sessionId,
  subagents,
}: UseSessionComposerControllerOptions): SessionComposerController {
  const promptFetcher = useFetcher();
  const commandFetcher = useFetcher();
  const abortFetcher = useFetcher();
  const lastHandledPromptDataRef = useRef<unknown>(null);
  const [activeTray, setActiveTray] = useState<ComposerTray>(null);
  const [modelSearch, setModelSearch] = useState("");
  const [collapsedProviderIDs, setCollapsedProviderIDs] = useState<Set<string>>(() => new Set());
  const {
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
    selectedModel,
    selectedVariant,
    applySelectedModel,
    setComposerText,
    setSelectedAgent,
    setSelectedVariant,
    updateComposerSelection,
  } = useSessionComposerDraft({ defaultAgent, defaultModel, defaultVariant, prefilledPrompt, sessionId });

  useEffect(() => {
    function handleInsertReference(event: Event) {
      if (!(event instanceof CustomEvent) || typeof event.detail !== "string") {
        return;
      }

      insertComposerReference(event.detail);
    }

    insertReferenceEvents.addEventListener("insert-reference", handleInsertReference);

    return () => {
      insertReferenceEvents.removeEventListener("insert-reference", handleInsertReference);
    };
  }, [insertComposerReference, insertReferenceEvents]);

  useEffect(() => {
    const data = promptFetcher.data as { clearDraft?: boolean; intent?: string; ok?: boolean } | undefined;

    if (!data) {
      lastHandledPromptDataRef.current = null;
      return;
    }

    if (lastHandledPromptDataRef.current === data) {
      return;
    }

    if (data.ok && data.clearDraft) {
      lastHandledPromptDataRef.current = data;
      onClearSessionError();
      void clearDraftContent();
    }
  }, [clearDraftContent, onClearSessionError, promptFetcher.data]);

  useEffect(() => {
    setActiveTray(null);
    setModelSearch("");
    setCollapsedProviderIDs(new Set());
  }, [sessionId]);

  const cycleAgent = useCallback(() => {
    setSelectedAgent((current) => {
      if (agents.length === 0) {
        return current;
      }

      const currentIndex = current ? agents.indexOf(current) : -1;

      if (currentIndex === -1) {
        return agents[0] ?? null;
      }

      return agents[(currentIndex + 1) % agents.length] ?? null;
    });
  }, [agents, setSelectedAgent]);

  const commandNames = useMemo(() => commands.map((command) => command.name), [commands]);
  const subagentNames = useMemo(() => subagents.map((subagent) => subagent.name), [subagents]);
  const parsedSlashCommand = useMemo(() => parseSlashCommand(composerText, commandNames), [commandNames, composerText]);
  const parsedSubagent = useMemo(() => parseSubagentMention(composerText, subagentNames), [composerText, subagentNames]);
  const matchedCommand = useMemo(() => {
    if (!parsedSlashCommand) {
      return null;
    }

    return commands.find((command) => command.name === parsedSlashCommand.command) ?? null;
  }, [commands, parsedSlashCommand]);
  const matchedSubagent = useMemo(() => {
    if (!parsedSubagent) {
      return null;
    }

    return subagents.find((subagent) => subagent.name === parsedSubagent.subagent) ?? null;
  }, [parsedSubagent, subagents]);

  const variantOptions = useMemo(() => selectedModel ? getModelVariants(selectedModel, providers) : [], [providers, selectedModel]);
  const currentVariant = selectedVariant && variantOptions.includes(selectedVariant) ? selectedVariant : null;
  const modelGroups = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();

    return providers.map((provider) => ({
      providerID: provider.id,
      providerLabel: provider.name,
      models: Object.values(provider.models).map((info) => ({
        key: `${provider.id}/${info.id}`,
        metadata: getModelMetadata(info),
        model: { modelID: info.id, providerID: provider.id },
        modelLabel: info.name,
      })).filter((entry) => {
        if (!query) {
          return true;
        }

        return [
          entry.key,
          entry.modelLabel,
          provider.name,
          entry.metadata.context,
          entry.metadata.cost,
          entry.metadata.status,
          entry.metadata.variants,
          entry.metadata.capabilities.reasoning ? "reasoning" : "",
          entry.metadata.capabilities.tools ? "tools" : "",
          entry.metadata.capabilities.files ? "files" : "",
        ].some((value) => (value ?? "").toLowerCase().includes(query));
      }),
    })).filter((group) => group.models.length > 0);
  }, [modelSearch, providers]);
  const recentItems = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();

    return recentModels.flatMap((choice) => {
      const provider = providers.find((item) => item.id === choice.model.providerID);
      const info = provider?.models[choice.model.modelID];

      if (!provider || !info) {
        return [];
      }

      const metadata = getModelMetadata(info);
      const item = {
        key: `recent:${provider.id}/${info.id}`,
        metadata,
        model: choice.model,
        modelLabel: info.name,
        providerLabel: provider.name,
        variant: choice.variant,
      };

      if (!query) {
        return [item];
      }

      const matches = [
        item.modelLabel,
        item.providerLabel,
        choice.variant,
        metadata.context,
        metadata.cost,
        metadata.status,
        metadata.variants,
        metadata.capabilities.reasoning ? "reasoning" : "",
        metadata.capabilities.tools ? "tools" : "",
        metadata.capabilities.files ? "files" : "",
      ].some((value) => (value ?? "").toLowerCase().includes(query));

      return matches ? [item] : [];
    });
  }, [modelSearch, providers, recentModels]);

  const submitPrompt = useCallback(() => {
    setActiveTray((current) => current === "commands" || current === "subagents" ? null : current);

    const formData = new FormData();
    formData.set("agent", selectedAgent ?? "");
    formData.set("modelProviderID", selectedModel?.providerID ?? "");
    formData.set("modelID", selectedModel?.modelID ?? "");
    formData.set("variant", currentVariant ?? "");
    images.forEach((image) => formData.append("attachments", image.file, image.file.name));

    if (parsedSlashCommand) {
      onClearSessionError();
      void clearDraftContent();
      formData.set("intent", "command");
      formData.set("arguments", parsedSlashCommand.arguments);
      formData.set("clearDraft", "1");
      formData.set("command", parsedSlashCommand.command);
      commandFetcher.submit(formData, { encType: "multipart/form-data", method: "post" });
      return;
    }

    formData.set("intent", "prompt");
    formData.set("text", composerText);
    promptFetcher.submit(formData, { encType: "multipart/form-data", method: "post" });
  }, [clearDraftContent, commandFetcher, composerText, currentVariant, images, onClearSessionError, parsedSlashCommand, promptFetcher, selectedAgent, selectedModel]);

  const submitAbort = useCallback(() => {
    const formData = new FormData();
    formData.set("intent", "abort");
    abortFetcher.submit(formData, { method: "post" });
  }, [abortFetcher]);

  const toggleCommandsTray = useCallback(() => {
    setActiveTray((current) => current === "commands" ? null : "commands");
  }, []);

  const toggleSubagentsTray = useCallback(() => {
    setActiveTray((current) => current === "subagents" ? null : "subagents");
  }, []);

  const toggleModelTray = useCallback(() => {
    setActiveTray((current) => current === "model" ? null : "model");
  }, []);

  const toggleProvider = useCallback((providerID: string) => {
    setCollapsedProviderIDs((current) => {
      const next = new Set(current);

      if (next.has(providerID)) {
        next.delete(providerID);
      } else {
        next.add(providerID);
      }

      return next;
    });
  }, []);

  const cycleVariant = useCallback(() => {
    if (variantOptions.length === 0) {
      return;
    }

    if (!currentVariant) {
      setSelectedVariant(variantOptions[0] ?? null);
      return;
    }

    const index = variantOptions.indexOf(currentVariant);

    if (index === -1 || index === variantOptions.length - 1) {
      setSelectedVariant(null);
      return;
    }

    setSelectedVariant(variantOptions[index + 1] ?? null);
  }, [currentVariant, setSelectedVariant, variantOptions]);

  const populateCommand = useCallback((commandName: string) => {
    const nextText = `/${commandName} `;
    setComposerText(nextText);

    window.requestAnimationFrame(() => {
      const input = composerInputRef.current;

      if (!input) {
        return;
      }

      input.focus();
      input.setSelectionRange(nextText.length, nextText.length);
      updateComposerSelection(input);
    });
  }, [composerInputRef, setComposerText, updateComposerSelection]);

  const populateSubagent = useCallback((subagentName: string) => {
    const nextText = `@${subagentName} `;
    setComposerText(nextText);

    window.requestAnimationFrame(() => {
      const input = composerInputRef.current;

      if (!input) {
        return;
      }

      input.focus();
      input.setSelectionRange(nextText.length, nextText.length);
      updateComposerSelection(input);
    });
  }, [composerInputRef, setComposerText, updateComposerSelection]);

  const selectModel = useCallback((model: OpencodeModelRef, variant?: string | null) => {
    applySelectedModel(model, variant);
    setActiveTray(null);
    setModelSearch("");
  }, [applySelectedModel]);

  const promptData = promptFetcher.data as { error?: string | null; intent?: string } | undefined;
  const commandData = commandFetcher.data as { error?: string | null; intent?: string } | undefined;
  const abortData = abortFetcher.data as { error?: string | null; intent?: string } | undefined;
  const commandError = commandData?.intent === "command" ? commandData.error ?? null : null;
  const promptError = promptData?.intent === "prompt" ? promptData.error ?? null : null;
  const abortError = abortData?.intent === "abort" ? abortData.error ?? null : null;
  const visibleTray: VisibleTray = activeTray === "model"
    ? "model"
    : activeTray === "commands"
      ? matchedCommand?.description
        ? "commands-description"
        : "commands-list"
      : activeTray === "subagents"
        ? matchedSubagent?.description
          ? "subagents-description"
          : "subagents-list"
      : images.length
        ? "images"
        : null;

  return {
    abortError,
    collapsedProviderIDs,
    commandDescription: matchedCommand?.description ?? null,
    commandError,
    commands,
    composerInputRef,
    composerText,
    currentVariant,
    imageInputRef,
    images,
    isAbortPending: abortFetcher.state !== "idle",
    isCommandPending: commandFetcher.state !== "idle",
    isPromptPending: promptFetcher.state !== "idle",
    isRestoringAttachments,
    modelGroups,
    modelSearch,
    promptError,
    recentModels: recentItems,
    selectedAgent,
    selectedModel,
    subagentDescription: matchedSubagent?.description ?? null,
    subagents,
    variantOptions,
    visibleTray,
    onAbort: submitAbort,
    onAddImages: (items) => addImages(getImageFiles(items)),
    onCommand: populateCommand,
    onCommandsToggle: toggleCommandsTray,
    onComposerTextChange: setComposerText,
    onCycleAgent: cycleAgent,
    onModelSearchChange: setModelSearch,
    onModelSelect: selectModel,
    onModelToggle: toggleModelTray,
    onProviderToggle: toggleProvider,
    onRemoveImage: removeImage,
    onSubagent: populateSubagent,
    onSubagentsToggle: toggleSubagentsTray,
    onSubmit: submitPrompt,
    onUpdateSelection: updateComposerSelection,
    onVariantCycle: cycleVariant,
  };
}
