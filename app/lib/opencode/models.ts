import type {
  OpencodeMessageInfo,
  OpencodeMessageWithParts,
  OpencodeModelRef,
  OpencodeProvider,
  OpencodeProviderCatalog,
} from "~/lib/opencode/events";

export type SessionModel = OpencodeModelRef;
export type SessionModelChoice = {
  model: SessionModel;
  variant: string | null;
};

export type TimestampedSessionModelChoice = SessionModelChoice & {
  usedAt: number;
};

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

export function parseModelRef(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const index = value.indexOf("/");

  if (index <= 0 || index >= value.length - 1) {
    return null;
  }

  return {
    modelID: value.slice(index + 1),
    providerID: value.slice(0, index),
  } satisfies SessionModel;
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

export function normalizeModelChoice(choice: SessionModelChoice | null | undefined, providers: OpencodeProvider[]) {
  if (!choice || !isKnownModel(choice.model, providers)) {
    return null;
  }

  const variants = new Set(getModelVariants(choice.model, providers));

  return {
    model: choice.model,
    variant: typeof choice.variant === "string" && variants.has(choice.variant) ? choice.variant : null,
  } satisfies SessionModelChoice;
}

export function getMessageInfoModelChoice(info: OpencodeMessageInfo): TimestampedSessionModelChoice | null {
  if (info.role === "user") {
    if (!info.model) {
      return null;
    }

    return {
      model: {
        modelID: info.model.modelID,
        providerID: info.model.providerID,
      },
      variant: info.model.variant ?? info.variant ?? null,
      usedAt: info.time.created,
    } satisfies TimestampedSessionModelChoice;
  }

  if (!info.modelID || !info.providerID) {
    return null;
  }

  return {
    model: {
      modelID: info.modelID,
      providerID: info.providerID,
    },
    variant: info.variant ?? null,
    usedAt: info.time.created,
  } satisfies TimestampedSessionModelChoice;
}

export function getMessageModelChoice(message: OpencodeMessageWithParts) {
  return getMessageInfoModelChoice(message.info);
}

export function getLatestMessageModelChoice(messages: OpencodeMessageWithParts[], providers: OpencodeProvider[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const choice = normalizeModelChoice(getMessageModelChoice(messages[index]!), providers);

    if (choice) {
      return choice;
    }
  }

  return null;
}

export function getInitialSessionModel(messages: OpencodeMessageWithParts[], catalog: OpencodeProviderCatalog) {
  const choice = getLatestMessageModelChoice(messages, catalog.providers);

  if (choice) {
    return choice.model;
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

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const choice = getMessageModelChoice(messages[index]!);

    if (!choice || choice.model.providerID !== model.providerID || choice.model.modelID !== model.modelID) {
      continue;
    }

    const normalized = normalizeModelChoice({ model, variant: choice.variant }, providers);

    if (normalized) {
      return normalized.variant;
    }
  }

  return null;
}
