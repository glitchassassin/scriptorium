import { getRuntimeConfiguration } from "~/lib/runtime-config/cache.server";
import { spawnOpencodeServeProcess, type ManagedOpencodeServeProcess } from "~/lib/projects/process.server";

type ManagedSharedServer = {
  managed: ManagedOpencodeServeProcess;
  port: number;
};

type SharedRuntimeGlobal = typeof globalThis & {
  __scriptoriumSharedOpencodeRuntime?: SharedOpencodeRuntime;
};

class SharedOpencodeRuntime {
  private current: Promise<ManagedSharedServer> | null = null;
  private lastError: Error | null = null;
  private isShuttingDown = false;
  private shutdownBound = false;

  async ensureStarted() {
    this.bindShutdown();

    try {
      await this.getOrStart();
      return true;
    } catch (error) {
      this.lastError = error instanceof Error ? error : new Error(String(error));
      return false;
    }
  }

  async getServerUrl() {
    const started = await this.ensureStarted();

    if (!started) {
      throw this.lastError ?? new Error("Shared Opencode server is unavailable.");
    }

    const server = await this.getOrStart();
    return `http://127.0.0.1:${server.port}`;
  }

  private async getOrStart() {
    if (!this.current) {
      this.current = this.start().catch((error) => {
        this.current = null;
        throw error;
      });
    }

    return this.current;
  }

  private async start() {
    const managed = spawnOpencodeServeProcess({
      cwd: getRuntimeConfiguration().config.workspace.browserRoot,
      label: "shared",
    });
    const port = await managed.ready;

    managed.child.once("error", (error) => {
      if (this.current) {
        this.current = null;
      }

      this.lastError = error instanceof Error ? error : new Error(String(error));
    });

    managed.child.once("exit", (code, signal) => {
      if (this.current) {
        this.current = null;
      }

      if (this.isShuttingDown || code === 0 || signal === "SIGTERM") {
        this.lastError = null;
        return;
      }

      this.lastError = new Error(
        `Shared Opencode process exited with code ${code ?? "unknown"}${signal ? ` (${signal})` : ""}.`,
      );
    });

    this.lastError = null;

    return {
      managed,
      port,
    } satisfies ManagedSharedServer;
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

      if (!current) {
        return;
      }

      const server = await current.catch(() => null);

      if (!server) {
        return;
      }

      await server.managed.stop();
    };

    process.once("exit", () => {
      this.isShuttingDown = true;

      const current = this.current;
      this.current = null;

      void current?.then((server) => {
        server.managed.child.kill("SIGTERM");
      }).catch(() => {});
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

export async function getSharedOpencodeServerUrl() {
  return getRuntime().getServerUrl();
}
