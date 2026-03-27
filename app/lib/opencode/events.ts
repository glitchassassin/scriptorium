import { z, type ZodType } from "zod";

const recordOfUnknown = z.record(z.string(), z.unknown());

const opencodePartBaseSchema = z.object({
  id: z.string(),
  sessionID: z.string(),
  messageID: z.string(),
});

export const opencodeSessionInfoSchema = z.object({
  id: z.string(),
  slug: z.string().optional(),
  version: z.string().optional(),
  projectID: z.string().optional(),
  workspaceID: z.string().optional(),
  directory: z.string(),
  parentID: z.string().optional(),
  title: z.string().optional(),
  time: z.object({
    created: z.number(),
    updated: z.number().optional(),
    compacting: z.number().optional(),
    archived: z.number().optional(),
  }),
  summary: z.unknown().optional(),
  share: z.unknown().optional(),
  permission: z.unknown().optional(),
  revert: z
    .object({
      messageID: z.string(),
      partID: z.string().optional(),
      snapshot: z.string().optional(),
      diff: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

export const opencodeSessionStatusSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("idle"),
  }),
  z.object({
    type: z.literal("busy"),
  }),
  z.object({
    type: z.literal("retry"),
    attempt: z.number(),
    message: z.string(),
    next: z.number(),
  }),
]);

export const opencodeSessionStatusMapSchema = z.record(z.string(), opencodeSessionStatusSchema);

export const opencodePermissionRequestSchema = z.object({
  id: z.string(),
  sessionID: z.string(),
  permission: z.string(),
  patterns: z.array(z.string()),
  metadata: recordOfUnknown,
  always: z.array(z.string()),
  tool: z
    .object({
      messageID: z.string(),
      callID: z.string(),
    })
    .optional(),
});

export const opencodeQuestionOptionSchema = z.object({
  label: z.string(),
  description: z.string(),
});

export const opencodeQuestionInfoSchema = z.object({
  question: z.string(),
  header: z.string(),
  options: z.array(opencodeQuestionOptionSchema),
  multiple: z.boolean().optional(),
  custom: z.boolean().optional(),
});

export const opencodeQuestionAnswerSchema = z.array(z.string());

export const opencodeQuestionRequestSchema = z.object({
  id: z.string(),
  sessionID: z.string(),
  questions: z.array(opencodeQuestionInfoSchema),
  tool: z
    .object({
      messageID: z.string(),
      callID: z.string(),
    })
    .optional(),
});

const opencodeModelRefSchema = z.object({
  providerID: z.string(),
  modelID: z.string(),
});

const opencodeModelCatalogEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  variants: z.record(z.string(), recordOfUnknown).optional(),
}).passthrough();

export const opencodeProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  models: z.record(z.string(), opencodeModelCatalogEntrySchema),
}).passthrough();

export const opencodeProviderCatalogSchema = z.object({
  default: z.record(z.string(), z.string()),
  providers: z.array(opencodeProviderSchema),
});

export const opencodeFileDiffSchema = z.object({
  file: z.string(),
  before: z.string(),
  after: z.string(),
  additions: z.number(),
  deletions: z.number(),
  status: z.enum(["added", "deleted", "modified"]).optional(),
});

const opencodeUserMessageSummarySchema = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
  diffs: z.array(opencodeFileDiffSchema).optional(),
}).passthrough();

const opencodeMessageErrorSchema = z.object({
  name: z.string(),
  message: z.string().optional(),
}).passthrough();

export const opencodeUserMessageSchema = z.object({
  id: z.string(),
  sessionID: z.string(),
  role: z.literal("user"),
  time: z.object({
    created: z.number(),
  }),
  agent: z.string().optional(),
  model: opencodeModelRefSchema.optional(),
  format: z.unknown().optional(),
  summary: opencodeUserMessageSummarySchema.optional(),
  system: z.string().optional(),
  tools: z.record(z.string(), z.boolean()).optional(),
  variant: z.string().optional(),
});

export const opencodeAssistantMessageSchema = z.object({
  id: z.string(),
  sessionID: z.string(),
  role: z.literal("assistant"),
  time: z.object({
    created: z.number(),
    completed: z.number().optional(),
  }),
  error: opencodeMessageErrorSchema.optional(),
  parentID: z.string(),
  modelID: z.string().optional(),
  providerID: z.string().optional(),
  mode: z.string().optional(),
  agent: z.string().optional(),
  path: z
    .object({
      cwd: z.string(),
      root: z.string(),
    })
    .optional(),
  summary: z.boolean().optional(),
  cost: z.number().optional(),
  tokens: z
    .object({
      total: z.number().optional(),
      input: z.number(),
      output: z.number(),
      reasoning: z.number(),
      cache: z.object({
        read: z.number(),
        write: z.number(),
      }),
    })
    .optional(),
  structured: z.unknown().optional(),
  variant: z.string().optional(),
  finish: z.string().optional(),
});

export const opencodeMessageInfoSchema = z.discriminatedUnion("role", [
  opencodeUserMessageSchema,
  opencodeAssistantMessageSchema,
]);

export const opencodeTextPartSchema = opencodePartBaseSchema.extend({
  type: z.literal("text"),
  text: z.string(),
  synthetic: z.boolean().optional(),
  ignored: z.boolean().optional(),
  time: z
    .object({
      start: z.number(),
      end: z.number().optional(),
    })
    .optional(),
  metadata: recordOfUnknown.optional(),
});

export const opencodeReasoningPartSchema = opencodePartBaseSchema.extend({
  type: z.literal("reasoning"),
  text: z.string(),
  metadata: recordOfUnknown.optional(),
  time: z.object({
    start: z.number(),
    end: z.number().optional(),
  }),
});

export const opencodeFilePartSchema = opencodePartBaseSchema.extend({
  type: z.literal("file"),
  mime: z.string(),
  filename: z.string().optional(),
  url: z.string(),
  source: z.unknown().optional(),
});

const opencodeToolInputSchema = z.record(z.string(), z.unknown());

export const opencodeToolStatePendingSchema = z.object({
  status: z.literal("pending"),
  input: opencodeToolInputSchema,
  raw: z.string(),
});

export const opencodeToolStateRunningSchema = z.object({
  status: z.literal("running"),
  input: opencodeToolInputSchema,
  title: z.string().optional(),
  metadata: recordOfUnknown.optional(),
  time: z.object({
    start: z.number(),
  }),
});

export const opencodeToolStateCompletedSchema = z.object({
  status: z.literal("completed"),
  input: opencodeToolInputSchema,
  output: z.string(),
  title: z.string(),
  metadata: recordOfUnknown,
  time: z.object({
    start: z.number(),
    end: z.number(),
    compacted: z.number().optional(),
  }),
  attachments: z.array(opencodeFilePartSchema).optional(),
});

export const opencodeToolStateErrorSchema = z.object({
  status: z.literal("error"),
  input: opencodeToolInputSchema,
  error: z.string(),
  metadata: recordOfUnknown.optional(),
  time: z.object({
    start: z.number(),
    end: z.number(),
  }),
});

export const opencodeToolStateSchema = z.discriminatedUnion("status", [
  opencodeToolStatePendingSchema,
  opencodeToolStateRunningSchema,
  opencodeToolStateCompletedSchema,
  opencodeToolStateErrorSchema,
]);

export const opencodeToolPartSchema = opencodePartBaseSchema.extend({
  type: z.literal("tool"),
  callID: z.string(),
  tool: z.string(),
  state: opencodeToolStateSchema,
  metadata: recordOfUnknown.optional(),
});

export const opencodeAgentPartSchema = opencodePartBaseSchema.extend({
  type: z.literal("agent"),
  name: z.string(),
  source: z
    .object({
      value: z.string(),
      start: z.number().int(),
      end: z.number().int(),
    })
    .optional(),
});

export const opencodeSubtaskPartSchema = opencodePartBaseSchema.extend({
  type: z.literal("subtask"),
  prompt: z.string(),
  description: z.string(),
  agent: z.string(),
  model: opencodeModelRefSchema.optional(),
  command: z.string().optional(),
});

export const opencodeRetryPartSchema = opencodePartBaseSchema.extend({
  type: z.literal("retry"),
  attempt: z.number(),
  error: z.object({
    message: z.string().optional(),
  }).passthrough(),
  time: z.object({
    created: z.number(),
  }),
});

export const opencodeStepStartPartSchema = opencodePartBaseSchema.extend({
  type: z.literal("step-start"),
  snapshot: z.string().optional(),
});

export const opencodeStepFinishPartSchema = opencodePartBaseSchema.extend({
  type: z.literal("step-finish"),
  reason: z.string(),
  snapshot: z.string().optional(),
  cost: z.number(),
  tokens: z.object({
    total: z.number().optional(),
    input: z.number(),
    output: z.number(),
    reasoning: z.number(),
    cache: z.object({
      read: z.number(),
      write: z.number(),
    }),
  }),
});

export const opencodeSnapshotPartSchema = opencodePartBaseSchema.extend({
  type: z.literal("snapshot"),
  snapshot: z.string(),
});

export const opencodePatchPartSchema = opencodePartBaseSchema.extend({
  type: z.literal("patch"),
  hash: z.string(),
  files: z.array(z.string()),
});

export const opencodeCompactionPartSchema = opencodePartBaseSchema.extend({
  type: z.literal("compaction"),
  auto: z.boolean(),
  overflow: z.boolean().optional(),
});

export const opencodeMessagePartSchema = z.discriminatedUnion("type", [
  opencodeTextPartSchema,
  opencodeReasoningPartSchema,
  opencodeFilePartSchema,
  opencodeToolPartSchema,
  opencodeAgentPartSchema,
  opencodeSubtaskPartSchema,
  opencodeRetryPartSchema,
  opencodeStepStartPartSchema,
  opencodeStepFinishPartSchema,
  opencodeSnapshotPartSchema,
  opencodePatchPartSchema,
  opencodeCompactionPartSchema,
]);

export const opencodeMessageWithPartsSchema = z.object({
  info: opencodeMessageInfoSchema,
  parts: z.array(opencodeMessagePartSchema),
});

export const opencodeSessionSummarySchema = opencodeSessionInfoSchema.transform((session) => ({
  id: session.id,
  parentID: session.parentID ?? null,
  title: session.title ?? null,
  directory: session.directory ?? null,
  createdAt: session.time.created ?? null,
  updatedAt: session.time.updated ?? null,
}));

export const opencodePromptInputSchema = z.object({
  parts: z.array(
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("text"),
        text: z.string(),
      }),
      z.object({
        type: z.literal("file"),
        mime: z.string(),
        filename: z.string().optional(),
        url: z.string(),
      }),
    ]),
  ),
  agent: z.string().optional(),
  model: opencodeModelRefSchema.optional(),
  variant: z.string().optional(),
});

export const opencodeCommandInputSchema = z.object({
  arguments: z.string(),
  command: z.string(),
  parts: opencodePromptInputSchema.shape.parts.optional(),
  agent: z.string().optional(),
  model: z.string().optional(),
  variant: z.string().optional(),
});

export const opencodeCommandInfoSchema = z.object({
  description: z.string().optional(),
  name: z.string(),
}).passthrough();

export const opencodeAgentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  mode: z.enum(["subagent", "primary", "all"]),
  native: z.boolean().optional(),
  hidden: z.boolean().optional(),
  topP: z.number().optional(),
  temperature: z.number().optional(),
  color: z.string().optional(),
  permission: z.unknown().optional(),
  model: z
    .object({
      modelID: z.string(),
      providerID: z.string(),
    })
    .optional(),
  variant: z.string().optional(),
  prompt: z.string().optional(),
  options: z.record(z.string(), z.unknown()).optional(),
  steps: z.number().optional(),
}).passthrough();

const serverConnectedEventSchema = z.object({
  type: z.literal("server.connected"),
  properties: z.object({}),
});

const serverHeartbeatEventSchema = z.object({
  type: z.literal("server.heartbeat"),
  properties: z.object({}),
});

export const opencodeSessionCreatedEventSchema = z.object({
  type: z.literal("session.created"),
  properties: z.object({
    info: opencodeSessionInfoSchema,
  }),
});

export const opencodeSessionUpdatedEventSchema = z.object({
  type: z.literal("session.updated"),
  properties: z.object({
    info: opencodeSessionInfoSchema,
  }),
});

export const opencodeSessionDeletedEventSchema = z.object({
  type: z.literal("session.deleted"),
  properties: z.object({
    info: opencodeSessionInfoSchema,
  }),
});

export const opencodeSessionStatusEventSchema = z.object({
  type: z.literal("session.status"),
  properties: z.object({
    sessionID: z.string(),
    status: opencodeSessionStatusSchema,
  }),
});

export const opencodeSessionErrorEventSchema = z.object({
  type: z.literal("session.error"),
  properties: z.object({
    sessionID: z.string().optional(),
    error: opencodeMessageErrorSchema,
  }),
});

export const opencodeSessionDiffEventSchema = z.object({
  type: z.literal("session.diff"),
  properties: z.object({
    sessionID: z.string(),
    diff: z.array(opencodeFileDiffSchema),
  }),
});

export const opencodeMessageUpdatedEventSchema = z.object({
  type: z.literal("message.updated"),
  properties: z.object({
    info: opencodeMessageInfoSchema,
  }),
});

export const opencodeMessageRemovedEventSchema = z.object({
  type: z.literal("message.removed"),
  properties: z.object({
    sessionID: z.string(),
    messageID: z.string(),
  }),
});

export const opencodeMessagePartUpdatedEventSchema = z.object({
  type: z.literal("message.part.updated"),
  properties: z.object({
    part: opencodeMessagePartSchema,
  }),
});

export const opencodeMessagePartDeltaEventSchema = z.object({
  type: z.literal("message.part.delta"),
  properties: z.object({
    sessionID: z.string(),
    messageID: z.string(),
    partID: z.string(),
    field: z.string(),
    delta: z.string(),
  }),
});

export const opencodeMessagePartRemovedEventSchema = z.object({
  type: z.literal("message.part.removed"),
  properties: z.object({
    sessionID: z.string(),
    messageID: z.string(),
    partID: z.string(),
  }),
});

export const opencodePermissionAskedEventSchema = z.object({
  type: z.literal("permission.asked"),
  properties: opencodePermissionRequestSchema,
});

export const opencodePermissionRepliedEventSchema = z.object({
  type: z.literal("permission.replied"),
  properties: z.object({
    sessionID: z.string().optional(),
    requestID: z.string(),
  }),
});

export const opencodeQuestionAskedEventSchema = z.object({
  type: z.literal("question.asked"),
  properties: opencodeQuestionRequestSchema,
});

export const opencodeQuestionRepliedEventSchema = z.object({
  type: z.literal("question.replied"),
  properties: z.object({
    sessionID: z.string(),
    requestID: z.string(),
    answers: z.array(opencodeQuestionAnswerSchema),
  }),
});

export const opencodeQuestionRejectedEventSchema = z.object({
  type: z.literal("question.rejected"),
  properties: z.object({
    sessionID: z.string(),
    requestID: z.string(),
  }),
});

export const opencodeSessionMutationEventSchema = z.union([
  opencodeSessionCreatedEventSchema,
  opencodeSessionUpdatedEventSchema,
  opencodeSessionDeletedEventSchema,
]);

export const opencodeKnownEventSchema = z.union([
  serverConnectedEventSchema,
  serverHeartbeatEventSchema,
  opencodeSessionMutationEventSchema,
  opencodeSessionStatusEventSchema,
  opencodeSessionErrorEventSchema,
  opencodeSessionDiffEventSchema,
  opencodeMessageUpdatedEventSchema,
  opencodeMessageRemovedEventSchema,
  opencodeMessagePartUpdatedEventSchema,
  opencodeMessagePartDeltaEventSchema,
  opencodeMessagePartRemovedEventSchema,
  opencodePermissionAskedEventSchema,
  opencodePermissionRepliedEventSchema,
  opencodeQuestionAskedEventSchema,
  opencodeQuestionRepliedEventSchema,
  opencodeQuestionRejectedEventSchema,
]);

export const opencodeEventEnvelopeSchema = z.object({
  type: z.string(),
  properties: recordOfUnknown,
});

const opencodeEventSchemas = {
  "server.connected": serverConnectedEventSchema,
  "server.heartbeat": serverHeartbeatEventSchema,
  "session.created": opencodeSessionCreatedEventSchema,
  "session.updated": opencodeSessionUpdatedEventSchema,
  "session.deleted": opencodeSessionDeletedEventSchema,
  "session.status": opencodeSessionStatusEventSchema,
  "session.error": opencodeSessionErrorEventSchema,
  "session.diff": opencodeSessionDiffEventSchema,
  "message.updated": opencodeMessageUpdatedEventSchema,
  "message.removed": opencodeMessageRemovedEventSchema,
  "message.part.updated": opencodeMessagePartUpdatedEventSchema,
  "message.part.delta": opencodeMessagePartDeltaEventSchema,
  "message.part.removed": opencodeMessagePartRemovedEventSchema,
  "permission.asked": opencodePermissionAskedEventSchema,
  "permission.replied": opencodePermissionRepliedEventSchema,
  "question.asked": opencodeQuestionAskedEventSchema,
  "question.replied": opencodeQuestionRepliedEventSchema,
  "question.rejected": opencodeQuestionRejectedEventSchema,
} satisfies Record<string, ZodType>;

export type OpencodeKnownEventType = keyof typeof opencodeEventSchemas;

type OpencodeEventParseSuccess = {
  kind: "known";
  data: OpencodeKnownEvent;
  eventType: OpencodeKnownEventType;
};

type OpencodeEventParseUnknown = {
  kind: "unknown";
  data: z.infer<typeof opencodeEventEnvelopeSchema>;
  eventType: string;
};

type OpencodeEventParseInvalid = {
  kind: "invalid";
  eventType: string | null;
  error: z.ZodError;
};

export type OpencodeEventParseResult =
  | OpencodeEventParseSuccess
  | OpencodeEventParseUnknown
  | OpencodeEventParseInvalid;

export function parseOpencodeEvent(value: unknown): OpencodeEventParseResult {
  const envelope = opencodeEventEnvelopeSchema.safeParse(value);

  if (!envelope.success) {
    return {
      kind: "invalid",
      eventType: null,
      error: envelope.error,
    };
  }

  const schema = opencodeEventSchemas[envelope.data.type as OpencodeKnownEventType];

  if (!schema) {
    return {
      kind: "unknown",
      data: envelope.data,
      eventType: envelope.data.type,
    };
  }

  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    return {
      kind: "invalid",
      eventType: envelope.data.type,
      error: parsed.error,
    };
  }

  return {
    kind: "known",
    data: parsed.data,
    eventType: envelope.data.type as OpencodeKnownEventType,
  };
}

export type OpencodeEvent = OpencodeKnownEvent;
export type OpencodeKnownEvent = z.infer<typeof opencodeKnownEventSchema>;
export type OpencodeAgent = z.infer<typeof opencodeAgentSchema>;
export type OpencodeCommandInput = z.infer<typeof opencodeCommandInputSchema>;
export type OpencodeCommandInfo = z.infer<typeof opencodeCommandInfoSchema>;
export type OpencodeModelRef = z.infer<typeof opencodeModelRefSchema>;
export type OpencodeProvider = z.infer<typeof opencodeProviderSchema>;
export type OpencodeProviderCatalog = z.infer<typeof opencodeProviderCatalogSchema>;
export type OpencodePromptInput = z.infer<typeof opencodePromptInputSchema>;
export type OpencodeAgentPart = z.infer<typeof opencodeAgentPartSchema>;
export type OpencodeCompactionPart = z.infer<typeof opencodeCompactionPartSchema>;
export type OpencodeFilePart = z.infer<typeof opencodeFilePartSchema>;
export type OpencodeFileDiff = z.infer<typeof opencodeFileDiffSchema>;
export type OpencodeMessageInfo = z.infer<typeof opencodeMessageInfoSchema>;
export type OpencodeMessagePart = z.infer<typeof opencodeMessagePartSchema>;
export type OpencodeMessageWithParts = z.infer<typeof opencodeMessageWithPartsSchema>;
export type OpencodePatchPart = z.infer<typeof opencodePatchPartSchema>;
export type OpencodePermissionRequest = z.infer<typeof opencodePermissionRequestSchema>;
export type OpencodeQuestionAnswer = z.infer<typeof opencodeQuestionAnswerSchema>;
export type OpencodeQuestionInfo = z.infer<typeof opencodeQuestionInfoSchema>;
export type OpencodeQuestionOption = z.infer<typeof opencodeQuestionOptionSchema>;
export type OpencodeQuestionRequest = z.infer<typeof opencodeQuestionRequestSchema>;
export type OpencodeReasoningPart = z.infer<typeof opencodeReasoningPartSchema>;
export type OpencodeRetryPart = z.infer<typeof opencodeRetryPartSchema>;
export type OpencodeSessionInfo = z.infer<typeof opencodeSessionInfoSchema>;
export type OpencodeSessionRevert = NonNullable<OpencodeSessionInfo["revert"]>;
export type OpencodeSessionMutationEvent = z.infer<typeof opencodeSessionMutationEventSchema>;
export type OpencodeSessionStatus = z.infer<typeof opencodeSessionStatusSchema>;
export type OpencodeSubtaskPart = z.infer<typeof opencodeSubtaskPartSchema>;
export type OpencodeTextPart = z.infer<typeof opencodeTextPartSchema>;
export type OpencodeToolPart = z.infer<typeof opencodeToolPartSchema>;
export type OpencodeToolState = z.infer<typeof opencodeToolStateSchema>;
export type OpencodeToolStateCompleted = z.infer<typeof opencodeToolStateCompletedSchema>;
export type OpencodeToolStateError = z.infer<typeof opencodeToolStateErrorSchema>;
export type OpencodeToolStatePending = z.infer<typeof opencodeToolStatePendingSchema>;
export type OpencodeToolStateRunning = z.infer<typeof opencodeToolStateRunningSchema>;
