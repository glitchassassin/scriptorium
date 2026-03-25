import type {
  OpencodeMessageWithParts,
  OpencodeModelRef,
  OpencodeProvider,
  OpencodeProviderCatalog,
} from "~/lib/opencode/events";

export type SessionModel = OpencodeModelRef;

export type ModelCapabilities = {
  files: boolean;
  reasoning: boolean;
  tools: boolean;
};

export type ModelMetadata = {
  capabilities: ModelCapabilities;
  context: string | null;
  cost: string | null;
  status: string | null;
  variants: string | null;
};

export function getModelKey(model: SessionModel) {
  return `${model.providerID}/${model.modelID}`;
}

export function getModelVariants(model: SessionModel, providers: OpencodeProvider[]) {
  const info = providers.find((provider) => provider.id === model.providerID)?.models[model.modelID];
  return info?.variants ? Object.keys(info.variants) : [];
}

export function getModelLabel(model: SessionModel | null, providers: OpencodeProvider[]) {
  if (!model) {
    return "No model";
  }

  return providers.find((provider) => provider.id === model.providerID)?.models[model.modelID]?.name ?? model.modelID;
}

function formatContext(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M ctx`;
  }

  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k ctx`;
  }

  return `${value} ctx`;
}

function formatRate(value: number) {
  if (value >= 1) {
    return value.toFixed(2);
  }

  if (value >= 0.1) {
    return value.toFixed(2);
  }

  if (value >= 0.01) {
    return value.toFixed(3);
  }

  return value.toFixed(4);
}

function formatCost(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const input = "input" in value && typeof value.input === "number" ? value.input : null;
  const output = "output" in value && typeof value.output === "number" ? value.output : null;

  if (input === null && output === null) {
    return null;
  }

  if (input === 0 && output === 0) {
    return "free";
  }

  if (input !== null && output !== null) {
    return `$${formatRate(input)}/$${formatRate(output)}`;
  }

  if (input !== null) {
    return `$${formatRate(input)} in`;
  }

  return `$${formatRate(output ?? 0)} out`;
}

export function getModelMetadata(entry: OpencodeProvider["models"][string]) {
  const capabilities = "capabilities" in entry && entry.capabilities && typeof entry.capabilities === "object"
    ? entry.capabilities
    : null;
  const cost = "cost" in entry ? formatCost(entry.cost) : null;
  const limit = "limit" in entry && entry.limit && typeof entry.limit === "object"
    ? entry.limit
    : null;

  const context = limit && "context" in limit ? formatContext(limit.context) : null;

  return {
    capabilities: {
      files: Boolean(capabilities && "attachment" in capabilities && capabilities.attachment === true),
      reasoning: Boolean(capabilities && "reasoning" in capabilities && capabilities.reasoning === true),
      tools: Boolean(capabilities && "toolcall" in capabilities && capabilities.toolcall === true),
    },
    context,
    cost,
    status: "status" in entry && typeof entry.status === "string" && entry.status !== "active" ? entry.status : null,
    variants: entry.variants && Object.keys(entry.variants).length > 0 ? `${Object.keys(entry.variants).length} variants` : null,
  } satisfies ModelMetadata;
}

export function isKnownModel(model: SessionModel | null | undefined, providers: OpencodeProvider[]) {
  if (!model) {
    return false;
  }

  return Boolean(providers.find((provider) => provider.id === model.providerID)?.models[model.modelID]);
}

export function getInitialSessionModel(messages: OpencodeMessageWithParts[], catalog: OpencodeProviderCatalog) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (!message) {
      continue;
    }

    if (message.info.role === "user" && isKnownModel(message.info.model, catalog.providers)) {
      return message.info.model ?? null;
    }

    if (message.info.role === "assistant") {
      const model = message.info.modelID && message.info.providerID
        ? { modelID: message.info.modelID, providerID: message.info.providerID }
        : null;

      if (isKnownModel(model, catalog.providers)) {
        return model;
      }
    }
  }

  for (const provider of catalog.providers) {
    const modelID = catalog.default[provider.id] ?? Object.keys(provider.models)[0];

    if (modelID && provider.models[modelID]) {
      return { modelID, providerID: provider.id };
    }
  }

  return null;
}

export function getInitialSessionVariant(messages: OpencodeMessageWithParts[], model: SessionModel | null, providers: OpencodeProvider[]) {
  if (!model) {
    return null;
  }

  const variants = new Set(getModelVariants(model, providers));

  if (variants.size === 0) {
    return null;
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (!message?.info.variant || !variants.has(message.info.variant)) {
      continue;
    }

    if (message.info.role === "user") {
      if (message.info.model?.providerID === model.providerID && message.info.model?.modelID === model.modelID) {
        return message.info.variant;
      }

      continue;
    }

    if (message.info.role === "assistant" && message.info.providerID === model.providerID && message.info.modelID === model.modelID) {
      return message.info.variant;
    }
  }

  return null;
}
