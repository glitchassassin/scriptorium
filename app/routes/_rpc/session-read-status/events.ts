import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { subscribeToSessionReadEvents } from "~/lib/session-read-status.server";

import type { Route } from "./+types/events";

const encoder = new TextEncoder();

function encodeEvent(payload: unknown) {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function encodeComment(comment: string) {
  return encoder.encode(`: ${comment}\n\n`);
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuthenticatedPasskey(request);

  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let unsubscribe = () => {};

      const close = () => {
        if (closed) {
          return;
        }

        closed = true;
        if (heartbeat) {
          clearInterval(heartbeat);
        }
        unsubscribe();
        request.signal.removeEventListener("abort", close);
        controller.close();
      };

      unsubscribe = subscribeToSessionReadEvents((event) => {
        if (closed) {
          return;
        }

        controller.enqueue(encodeEvent(event));
      });
      heartbeat = setInterval(() => {
        if (closed) {
          return;
        }

        controller.enqueue(encodeComment("keep-alive"));
      }, 15_000);

      request.signal.addEventListener("abort", close, { once: true });
      controller.enqueue(encodeComment("connected"));
    },
    cancel() {},
  }), {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
}
