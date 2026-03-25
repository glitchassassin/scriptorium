import { Icon } from "@iconify/react";

import { ComposerPanelTray, ComposerTrayFrame } from "~/components/ui/composer-trays";
import { cn } from "~/lib/cn";
import type { OpencodeModelRef } from "~/lib/opencode/events";
import type { ModelCapabilities } from "~/lib/opencode/models";
import type { SessionComposerModelGroup } from "./session-composer-types";

function ModelCapabilityIcons({ capabilities, isSelected }: { capabilities: ModelCapabilities; isSelected: boolean }) {
  const iconClassName = cn("size-4", isSelected ? "text-white" : "text-black");
  const placeholderClassName = cn("inline-block size-4", isSelected ? "text-white/25" : "text-black/25");

  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {capabilities.reasoning ? <Icon className={iconClassName} icon="mdi:brain" /> : <span className={placeholderClassName} />}
      {capabilities.tools ? <Icon className={iconClassName} icon="mdi:wrench" /> : <span className={placeholderClassName} />}
      {capabilities.files ? <Icon className={iconClassName} icon="mdi:paperclip" /> : <span className={placeholderClassName} />}
    </span>
  );
}

export function SessionComposerModelTray({
  collapsedProviderIDs,
  modelGroups,
  modelSearch,
  onModelSearchChange,
  onModelSelect,
  onProviderToggle,
  selectedModel,
}: {
  collapsedProviderIDs: Set<string>;
  modelGroups: SessionComposerModelGroup[];
  modelSearch: string;
  onModelSearchChange: (value: string) => void;
  onModelSelect: (model: OpencodeModelRef) => void;
  onProviderToggle: (providerID: string) => void;
  selectedModel: OpencodeModelRef | null;
}) {
  const effectiveCollapsedProviderIDs = modelSearch.trim() ? new Set<string>() : collapsedProviderIDs;

  return (
    <ComposerTrayFrame>
      <ComposerPanelTray title="Model">
        <input
          aria-label="Search models"
          className="min-h-11 w-full bg-white px-3 py-2 text-base"
          placeholder="Search models"
          onChange={(event) => onModelSearchChange(event.currentTarget.value)}
          type="text"
          value={modelSearch}
        />
        <div className="space-y-4">
          {modelGroups.length ? modelGroups.map((group) => (
            <section className="space-y-2" key={group.providerID}>
              <button
                aria-label={`Toggle ${group.providerLabel} models`}
                className="flex min-h-11 w-full items-center gap-2 text-left text-sm font-bold uppercase tracking-[0.08em]"
                onClick={() => onProviderToggle(group.providerID)}
                type="button"
              >
                <Icon
                  className={cn(
                    "size-4 transition-transform",
                    effectiveCollapsedProviderIDs.has(group.providerID) ? "-rotate-90" : "rotate-0",
                  )}
                  icon="mdi:chevron-down"
                />
                <span>{group.providerLabel}</span>
              </button>
              <div hidden={effectiveCollapsedProviderIDs.has(group.providerID)}>
                {group.models.map((entry, index) => {
                  const isSelected = selectedModel?.providerID === entry.model.providerID && selectedModel?.modelID === entry.model.modelID;

                  return (
                    <button
                      aria-label={`Use ${group.providerLabel} ${entry.modelLabel}`}
                      className={cn(
                        "flex min-h-14 w-full items-start justify-between gap-3 px-1 py-3 text-left text-base",
                        index > 0 ? "border-t border-black" : "",
                        isSelected ? "bg-black text-white" : "bg-white text-black",
                      )}
                      key={entry.key}
                      onClick={() => onModelSelect(entry.model)}
                      type="button"
                    >
                      <span className="min-w-0 space-y-1">
                        <span className="block">{entry.modelLabel}</span>
                        <span className={cn("flex items-center gap-3 text-sm", isSelected ? "text-white/80" : "text-black/70")}>
                          <ModelCapabilityIcons capabilities={entry.metadata.capabilities} isSelected={isSelected} />
                          <span>{[entry.metadata.context, entry.metadata.cost].filter(Boolean).join(" ")}</span>
                          {entry.metadata.status || entry.metadata.variants ? (
                            <span>{[entry.metadata.status, entry.metadata.variants].filter(Boolean).join(" · ")}</span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )) : <p className="text-base leading-6">No models match that search.</p>}
        </div>
      </ComposerPanelTray>
    </ComposerTrayFrame>
  );
}
