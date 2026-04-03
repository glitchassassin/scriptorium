import { z } from "zod";

import { opencodeSessionStatusSchema } from "~/lib/opencode/events";

const projectSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  directory: z.string(),
});

export const sessionReadEventSchema = z.object({
  type: z.literal("session.read"),
  sessionId: z.string(),
  lastReadAt: z.number(),
});

const sessionProjectScopeSchema = {
  projectId: z.string(),
};

export const sessionActivityEventSchema = z.object({
  type: z.literal("session.activity"),
  ...sessionProjectScopeSchema,
  sessionId: z.string(),
  updatedAt: z.number(),
});

export const sessionSidebarSummarySchema = z.object({
  id: z.string(),
  parentID: z.string().nullable(),
  title: z.string().nullable(),
  directory: z.string().nullable(),
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
});

export const sessionSummaryEventSchema = z.object({
  type: z.literal("session.summary"),
  ...sessionProjectScopeSchema,
  summary: sessionSidebarSummarySchema,
});

export const sessionStatusEventSchema = z.object({
  type: z.literal("session.status"),
  ...sessionProjectScopeSchema,
  sessionId: z.string(),
  status: opencodeSessionStatusSchema,
});

export const sessionDeletedEventSchema = z.object({
  type: z.literal("session.deleted"),
  ...sessionProjectScopeSchema,
  sessionId: z.string(),
});

export const projectChangedEventSchema = z.object({
  type: z.literal("project.changed"),
  project: projectSummarySchema,
});

export const projectRemovedEventSchema = z.object({
  type: z.literal("project.removed"),
  projectId: z.string(),
});

export const sessionQuestionAskedEventSchema = z.object({
  type: z.literal("session.question.asked"),
  ...sessionProjectScopeSchema,
  sessionId: z.string(),
  requestId: z.string(),
});

export const sessionQuestionRepliedEventSchema = z.object({
  type: z.literal("session.question.replied"),
  ...sessionProjectScopeSchema,
  sessionId: z.string(),
  requestId: z.string(),
});

export const sessionQuestionRejectedEventSchema = z.object({
  type: z.literal("session.question.rejected"),
  ...sessionProjectScopeSchema,
  sessionId: z.string(),
  requestId: z.string(),
});

export const sessionEventSchema = z.discriminatedUnion("type", [
  sessionReadEventSchema,
  sessionActivityEventSchema,
  sessionSummaryEventSchema,
  sessionStatusEventSchema,
  sessionDeletedEventSchema,
  projectChangedEventSchema,
  projectRemovedEventSchema,
  sessionQuestionAskedEventSchema,
  sessionQuestionRepliedEventSchema,
  sessionQuestionRejectedEventSchema,
]);

export type SessionReadEvent = z.infer<typeof sessionReadEventSchema>;
export type SessionActivityEvent = z.infer<typeof sessionActivityEventSchema>;
export type SessionSummaryEvent = z.infer<typeof sessionSummaryEventSchema>;
export type SessionStatusEvent = z.infer<typeof sessionStatusEventSchema>;
export type SessionDeletedEvent = z.infer<typeof sessionDeletedEventSchema>;
export type ProjectChangedEvent = z.infer<typeof projectChangedEventSchema>;
export type ProjectRemovedEvent = z.infer<typeof projectRemovedEventSchema>;
export type SessionQuestionAskedEvent = z.infer<typeof sessionQuestionAskedEventSchema>;
export type SessionQuestionRepliedEvent = z.infer<typeof sessionQuestionRepliedEventSchema>;
export type SessionQuestionRejectedEvent = z.infer<typeof sessionQuestionRejectedEventSchema>;
export type SessionEvent = z.infer<typeof sessionEventSchema>;
export type SessionEventType = SessionEvent["type"];
export type SessionSidebarSummary = z.infer<typeof sessionSidebarSummarySchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;

export function parseSessionReadTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : null;
}
