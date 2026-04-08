import { getRuntimeConfiguration } from "../runtime-config/cache.server.ts";
import {
  invalidateOpencodeVersionCache,
  readOpencodeVersion,
  spawnOpencodeServeProcess,
  type ManagedOpencodeServeProcess,
} from "../projects/process.server.ts";

type ManagedSharedServer = {
  managed: ManagedOpencodeServeProcess;
  port: number;
  startedAt: number;
  version: string | null;
};

export type SharedOpencodeRuntimeState =
  | {
      mode: "external";
      serverUrl: string;
    }
  | {
      mode: "managed";
      browserRoot: string;
    };

export type SharedOpencodeRuntimeStatus = {
  activeSince: number | null;
  error: string | null;
  installedVersion: string | null;
  isRunning: boolean;
  mode: SharedOpencodeRuntimeState["mode"];
  restartRequired: boolean;
  runningVersion: string | null;
  serverUrl: string | null;
};

type ProbedServerStatus = {
  error: string | null;
  version: string | null;
};

type CachedStatus = {
  expiresAt: number;
  value: SharedOpencodeRuntimeStatus;
};

export const OPENCODE_NOT_RUNNING_MESSAGE = "OpenCode is not running.";
const STATUS_CACHE_TTL_MS = 5_000;

export class OpencodeNotRunningError extends Error {
  constructor(message = OPENCODE_NOT_RUNNING_MESSAGE) {
    super(message);
    this.name = "OpencodeNotRunningError";
  }
}

type SharedRuntimeGlobal = typeof globalThis & {
  __scriptoriumSharedOpencodeRuntime?: SharedOpencodeRuntime;
};

function getConfiguredOpencodeServerUrl() {
  return getRuntimeConfiguration().config.opencode.url ?? null;
}

class SharedOpencodeRuntime {
  private current: ManagedSharedServer | null = null;
  private lastError: Error | null = null;
  private installedVersion: string | null = null;
  private isShuttingDown = false;
  private shutdownBound = false;
  private operation: Promise<void> = Promise.resolve();
  private restarting: Promise<string> | null = null;
  private statusCache: CachedStatus | null = null;

  getState() {
    const configuredServerUrl = getConfiguredOpencodeServerUrl();

    if (configuredServerUrl) {
      return {
        mode: "external",
        serverUrl: configuredServerUrl,
      } satisfies SharedOpencodeRuntimeState;
    }

    return {
      mode: "managed",
      browserRoot: getRuntimeConfiguration().config.workspace.browserRoot,
    } satisfies SharedOpencodeRuntimeState;
  }

  async ensureStarted() {
    try {
      await this.start();
      return true;
    } catch (error) {
      this.lastError = this.toError(error);
      return false;
    }
  }

  async start() {
    const state = this.getState();

    if (state.mode === "external") {
      this.lastError = null;
      return state.serverUrl;
    }

    this.bindShutdown();

    try {
      const instance = await this.runExclusive(() => this.getOrStart());
      this.invalidateStatusCache();
      return `http://127.0.0.1:${instance.port}`;
    } catch (error) {
      this.lastError = this.toError(error);
      throw this.lastError ?? new Error("Shared Opencode server is unavailable.");
    }
  }

  getRunningServerUrl() {
    const state = this.getState();

    if (state.mode === "external") {
      return state.serverUrl;
    }

    // Read-only callers use this to observe the current runtime without
    // implicitly starting OpenCode. Lifecycle changes stay explicit.
    if (!this.current) {
      return null;
    }

    return `http://127.0.0.1:${this.current.port}`;
  }

  async restart() {
    const state = this.getState();

    if (state.mode === "external") {
      throw new Error("OpenCode is managed externally.");
    }

    this.bindShutdown();

    if (this.restarting) {
      return this.restarting;
    }

    const restarting = this.runExclusive(async () => {
      const current = this.current;

      // Clear the active instance before stopping it so late exit callbacks
      // from the old child cannot wipe out the replacement runtime.
      this.current = null;
      this.invalidateStatusCache();

      if (current) {
        await current.managed.stop();
      }

      const server = await this.getOrStart();
      return `http://127.0.0.1:${server.port}`;
    });

    this.restarting = restarting;

    try {
      return await restarting;
    } catch (error) {
      this.lastError = this.toError(error);
      throw this.lastError;
    } finally {
      if (this.restarting === restarting) {
        this.restarting = null;
      }
    }
  }

  async update() {
    const state = this.getState();

    if (state.mode === "external") {
      throw new Error("OpenCode is managed externally.");
    }

    return this.runExclusive(async () => {
      const current = this.current;

      if (!current) {
        throw new Error("Start OpenCode before updating it.");
      }

      const response = await fetch(`http://127.0.0.1:${current.port}/global/upgrade`, {
        body: JSON.stringify({}),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`OpenCode update request failed with ${response.status}.`);
      }

      const payload = await response.json() as unknown;

      if (!payload || typeof payload !== "object") {
        throw new Error("OpenCode update returned an invalid response.");
      }

      const result = payload as { error?: unknown; success?: unknown; version?: unknown };

      if (result.success === true && typeof result.version === "string") {
        invalidateOpencodeVersionCache();
        this.installedVersion = result.version;
        this.invalidateStatusCache();
        return result.version;
      }

      if (result.success === false && typeof result.error === "string") {
        throw new Error(result.error);
      }

      throw new Error("OpenCode update returned an invalid response.");
    });
  }

  async getStatus() {
    const cached = this.statusCache;

    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const state = this.getState();

    if (state.mode === "external") {
      const serverStatus = await this.probeServerStatus(state.serverUrl);

      const value = {
        activeSince: null,
        error: serverStatus.error,
        installedVersion: null,
        isRunning: serverStatus.error === null,
        mode: "external",
        restartRequired: false,
        runningVersion: serverStatus.version,
        serverUrl: state.serverUrl,
      } satisfies SharedOpencodeRuntimeStatus;

      this.cacheStatus(value);
      return value;
    }

    const server = this.current;
    const installedVersion = this.getInstalledVersion();

    if (!server) {
      const value = {
        activeSince: null,
        error: this.lastError?.message ?? null,
        installedVersion,
        isRunning: false,
        mode: "managed",
        restartRequired: false,
        runningVersion: null,
        serverUrl: null,
      } satisfies SharedOpencodeRuntimeStatus;

      this.cacheStatus(value);
      return value;
    }

    const serverUrl = server ? `http://127.0.0.1:${server.port}` : null;
    const runningVersion = server.version;

    const value = {
      activeSince: server?.startedAt ?? null,
      error: this.lastError?.message ?? null,
      installedVersion,
      isRunning: true,
      mode: "managed",
      restartRequired: runningVersion !== null && installedVersion !== null && runningVersion !== installedVersion,
      runningVersion,
      serverUrl,
    } satisfies SharedOpencodeRuntimeStatus;

    this.cacheStatus(value);
    return value;
  }

  private async getOrStart() {
    if (this.current) {
      return this.current;
    }

    const instance = await this.spawn();
    this.current = instance;
    return instance;
  }

  private async spawn() {
    const managed = spawnOpencodeServeProcess({
      cwd: getRuntimeConfiguration().config.workspace.browserRoot,
      label: "shared",
    });
    const port = await managed.ready;
    const status = await this.probeServerStatus(`http://127.0.0.1:${port}`);
    // The running server version stays fixed for the life of this process, so
    // capture it once here instead of probing health on every status read.
    const installedVersion = this.getInstalledVersion();
    const server = {
      managed,
      port,
      startedAt: Date.now(),
      version: status.version,
    } satisfies ManagedSharedServer;

    this.installedVersion = installedVersion;

    managed.child.once("error", (error) => {
      if (this.current === server) {
        this.current = null;
      }

      this.lastError = this.toError(error);
      this.invalidateStatusCache();
    });

    managed.child.once("exit", (code, signal) => {
      if (this.current === server) {
        this.current = null;
      }

      this.invalidateStatusCache();

      if (this.isShuttingDown || code === 0 || signal === "SIGTERM") {
        this.lastError = null;
        return;
      }

      this.lastError = new Error(
        `Shared Opencode process exited with code ${code ?? "unknown"}${signal ? ` (${signal})` : ""}.`,
      );
    });

    this.lastError = null;

    return server;
  }

  private async runExclusive<Result>(operation: () => Promise<Result>) {
    // The shared runtime is a singleton process, so lifecycle operations are
    // serialized to keep start/restart/update transitions from overlapping.
    const previous = this.operation;
    let release = () => {};

    this.operation = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous.catch(() => {});

    try {
      return await operation();
    } finally {
      release();
    }
  }

  private toError(error: unknown) {
    return error instanceof Error ? error : new Error(String(error));
  }

  private cacheStatus(value: SharedOpencodeRuntimeStatus) {
    this.statusCache = {
      expiresAt: Date.now() + STATUS_CACHE_TTL_MS,
      value,
    };
  }

  private invalidateStatusCache() {
    this.statusCache = null;
  }

  private readLocalVersion() {
    try {
      return readOpencodeVersion();
    } catch {
      return null;
    }
  }

  private getInstalledVersion() {
    if (this.installedVersion !== null) {
      return this.installedVersion;
    }

    this.installedVersion = this.readLocalVersion();
    return this.installedVersion;
  }

  private async probeServerStatus(serverUrl: string): Promise<ProbedServerStatus> {
    try {
      const response = await fetch(`${serverUrl}/global/health`);

      if (!response.ok) {
        return {
          error: `Configured OpenCode server status check failed with ${response.status}.`,
          version: null,
        };
      }

      const payload = await response.json() as unknown;

      if (!payload || typeof payload !== "object") {
        return {
          error: "Configured OpenCode server returned an invalid status response.",
          version: null,
        };
      }

      const version = (payload as { version?: unknown }).version;

      if (typeof version !== "string") {
        return {
          error: "Configured OpenCode server returned an invalid status response.",
          version: null,
        };
      }

      return {
        error: null,
        version,
      };
    } catch {
      return {
        error: "Configured OpenCode server is unavailable.",
        version: null,
      };
    }
  }

  private bindShutdown() {
    if (this.shutdownBound) {
      return;
    }

    this.shutdownBound = true;

    const shutdown = async () => {
      this.isShuttingDown = true;
      const current = this.current;
      this.current = null;
      this.invalidateStatusCache();

      if (!current) {
        return;
      }

      await current.managed.stop();
    };

    process.once("exit", () => {
      this.isShuttingDown = true;

      const current = this.current;
      this.current = null;
      this.invalidateStatusCache();

      current?.managed.child.kill("SIGTERM");
    });
    process.once("SIGINT", () => {
      void shutdown().finally(() => process.exit(0));
    });
    process.once("SIGTERM", () => {
      void shutdown().finally(() => process.exit(0));
    });
  }
}

function getRuntime() {
  const runtimeGlobal = globalThis as SharedRuntimeGlobal;

  if (!runtimeGlobal.__scriptoriumSharedOpencodeRuntime) {
    runtimeGlobal.__scriptoriumSharedOpencodeRuntime = new SharedOpencodeRuntime();
  }

  return runtimeGlobal.__scriptoriumSharedOpencodeRuntime;
}

export function createProjectScopedHeaders(directory: string, headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);
  nextHeaders.set("x-opencode-directory", encodeURIComponent(directory));
  return nextHeaders;
}

export async function ensureSharedOpencodeServerStarted() {
  return getRuntime().ensureStarted();
}

export async function startSharedOpencodeServer() {
  return getRuntime().start();
}

export function getRunningSharedOpencodeServerUrl() {
  return getRuntime().getRunningServerUrl();
}

export function getRequiredRunningSharedOpencodeServerUrl() {
  const url = getRuntime().getRunningServerUrl();

  if (!url) {
    throw new OpencodeNotRunningError();
  }

  return url;
}

export function getSharedOpencodeRuntimeState() {
  return getRuntime().getState();
}

export async function getSharedOpencodeRuntimeStatus() {
  return getRuntime().getStatus();
}

export async function restartSharedOpencodeServer() {
  return getRuntime().restart();
}

export async function updateSharedOpencodeServer() {
  return getRuntime().update();
}
