import { z } from "zod";

export const sessionReadEventSchema = z.object({
  type: z.literal("session.read"),
  instanceId: z.string(),
  sessionId: z.string(),
  lastReadAt: z.number(),
});

export type SessionReadEvent = z.infer<typeof sessionReadEventSchema>;

export function parseSessionReadTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : null;
}
