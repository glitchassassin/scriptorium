const RECONNECT_DELAYS_MS = [250, 500, 1000, 2000, 5000] as const;

type PersistentEventSourceOptions = {
  onMessage?: (event: MessageEvent<string>) => void;
  onReconnect?: () => void;
};

export class PersistentEventSource {
  private source: EventSource | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private disconnected = false;
  private attempt = 0;

  constructor(
    private readonly url: string,
    private readonly options: PersistentEventSourceOptions = {},
  ) {
    this.connect();
  }

  close() {
    this.closed = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.source?.close();
    this.source = null;
  }

  private connect() {
    if (this.closed) {
      return;
    }

    const source = new EventSource(this.url);
    this.source = source;

    source.onopen = () => {
      if (this.source !== source || this.closed) {
        return;
      }

      const reconnected = this.disconnected;

      this.disconnected = false;
      this.attempt = 0;

      if (reconnected) {
        this.options.onReconnect?.();
      }
    };

    source.onerror = () => {
      if (this.source !== source || this.closed) {
        return;
      }

      this.disconnected = true;
      this.source = null;
      source.close();
      this.scheduleReconnect();
    };

    source.onmessage = (event) => {
      if (this.source !== source || this.closed) {
        return;
      }

      this.options.onMessage?.(event);
    };
  }

  private scheduleReconnect() {
    if (this.closed || this.reconnectTimer) {
      return;
    }

    const delay = RECONNECT_DELAYS_MS[Math.min(this.attempt, RECONNECT_DELAYS_MS.length - 1)] ?? 5000;
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

export { RECONNECT_DELAYS_MS };
