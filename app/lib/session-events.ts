import { z } from "zod";

import { opencodeSessionStatusSchema } from "~/lib/opencode/events";

export const sessionReadEventSchema = z.object({
  type: z.literal("session.read"),
  sessionId: z.string(),
  lastReadAt: z.number(),
});

export const sessionActivityEventSchema = z.object({
  type: z.literal("session.activity"),
  instanceId: z.string(),
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
  instanceId: z.string(),
  summary: sessionSidebarSummarySchema,
});

export const sessionStatusEventSchema = z.object({
  type: z.literal("session.status"),
  instanceId: z.string(),
  sessionId: z.string(),
  status: opencodeSessionStatusSchema,
});

export const sessionDeletedEventSchema = z.object({
  type: z.literal("session.deleted"),
  instanceId: z.string(),
  sessionId: z.string(),
});

export const sessionEventSchema = z.discriminatedUnion("type", [
  sessionReadEventSchema,
  sessionActivityEventSchema,
  sessionSummaryEventSchema,
  sessionStatusEventSchema,
  sessionDeletedEventSchema,
]);

export type SessionReadEvent = z.infer<typeof sessionReadEventSchema>;
export type SessionActivityEvent = z.infer<typeof sessionActivityEventSchema>;
export type SessionSummaryEvent = z.infer<typeof sessionSummaryEventSchema>;
export type SessionStatusEvent = z.infer<typeof sessionStatusEventSchema>;
export type SessionDeletedEvent = z.infer<typeof sessionDeletedEventSchema>;
export type SessionEvent = z.infer<typeof sessionEventSchema>;
export type SessionEventType = SessionEvent["type"];
export type SessionSidebarSummary = z.infer<typeof sessionSidebarSummarySchema>;

export function parseSessionReadTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : null;
}
