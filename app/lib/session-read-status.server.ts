import { type SessionReadEvent } from "~/lib/session-events";
import {
  listSessionReadStatuses,
  markSessionRead,
  subscribeToSessionEvents,
  type SessionReadKey,
  type SessionReadStatusRecord,
} from "~/lib/session-events.server";

type SessionReadSubscriber = (event: SessionReadEvent) => void;

function subscribeToSessionReadEvents(subscriber: SessionReadSubscriber) {
  return subscribeToSessionEvents((event) => {
    if (event.type !== "session.read") {
      return;
    }

    subscriber(event);
  }, {
    types: ["session.read"],
  });
}

export { listSessionReadStatuses, markSessionRead, subscribeToSessionReadEvents };
export type { SessionReadKey, SessionReadStatusRecord };
