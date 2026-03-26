import type { OpencodeMessageWithParts } from "~/lib/opencode/events";

export const SESSION_MESSAGE_PAGE_SIZE = 50;

export type OpencodeMessagePage = {
  hasMore: boolean;
  items: OpencodeMessageWithParts[];
  nextCursor: string | null;
};
