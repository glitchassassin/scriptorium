import { getRunningSharedOpencodeServerUrl } from "~/lib/opencode/shared-runtime.server";

const encoder = new TextEncoder();
const RETRY_DELAY_MS = 500;
const HEARTBEAT_INTERVAL_MS = 15_000;

function encodeEvent(payload: string) {
  return encoder.encode(`data: ${payload}\n\n`);
}

function encodeComment(comment: string) {
  return encoder.encode(`: ${comment}\n\n`);
}

async function consume(stream: ReadableStream<Uint8Array>, onEvent: (payload: string) => void, signal: AbortSignal) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let data: string[] = [];

  const flush = () => {
    if (!data.length) {
      return;
    }

    onEvent(data.join("\n"));
    data = [];
  };

  try {
    while (!signal.aborted) {
      const chunk = await reader.read();

      if (chunk.done) {
        break;
      }

      buffer += decoder.decode(chunk.value, { stream: true });

      while (true) {
        const idx = buffer.indexOf("\n");

        if (idx === -1) {
          break;
        }

        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;

        if (!line) {
          flush();
          continue;
        }

        if (line.startsWith(":")) {
          continue;
        }

        if (line.startsWith("data:")) {
          data.push(line.slice(5).trimStart());
        }
      }
    }

    buffer += decoder.decode();

    if (buffer) {
      const line = buffer.endsWith("\r") ? buffer.slice(0, -1) : buffer;

      if (line.startsWith("data:")) {
        data.push(line.slice(5).trimStart());
      }
    }

    flush();
  } finally {
    reader.releaseLock();
  }
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

export function createGlobalEventsResponse(request: Request) {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | null = null;

      const close = () => {
        if (closed) {
          return;
        }

        closed = true;

        if (heartbeat) {
          clearInterval(heartbeat);
        }

        request.signal.removeEventListener("abort", close);
        controller.close();
      };

      const pump = async () => {
        while (!request.signal.aborted && !closed) {
          const baseUrl = getRunningSharedOpencodeServerUrl();

          if (!baseUrl) {
            // The global stream should wait for a running instance rather than
            // starting OpenCode implicitly just because a listener connected.
            await wait(RETRY_DELAY_MS, request.signal);
            continue;
          }

          try {
            const response = await fetch(`${baseUrl}/global/event`, {
              headers: {
                Accept: "text/event-stream",
              },
              signal: request.signal,
            });

            if (!response.ok || !response.body) {
              throw new Error(`Global event stream request failed with ${response.status}`);
            }

            await consume(response.body, (payload) => {
              if (!closed) {
                controller.enqueue(encodeEvent(payload));
              }
            }, request.signal);
          } catch {
            if (request.signal.aborted || closed) {
              return;
            }

            await wait(RETRY_DELAY_MS, request.signal);
          }
        }
      };

      heartbeat = setInterval(() => {
        if (!closed) {
          controller.enqueue(encodeComment("keep-alive"));
        }
      }, HEARTBEAT_INTERVAL_MS);

      request.signal.addEventListener("abort", close, { once: true });
      controller.enqueue(encodeComment("connected"));
      void pump().finally(close);
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
