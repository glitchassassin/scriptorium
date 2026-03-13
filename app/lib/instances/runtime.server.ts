import { randomUUID } from "node:crypto";
import { basename } from "node:path";

import { spawnInstanceProcess } from "~/lib/instances/process.server";
import {
  createStoredInstance,
  deleteStoredInstance,
  getStoredInstance,
  listStoredInstances,
  updateStoredInstance,
} from "~/lib/instances/store.server";
import { validateFileSelection } from "~/lib/instances/files.server";
import type { InstanceRecord } from "~/lib/instances/types";

type ManagedProcess = ReturnType<typeof spawnInstanceProcess>;

class InstanceRuntime {
  private readonly processes = new Map<string, ManagedProcess>();
  private isShuttingDown = false;
  private shutdownBound = false;

  async ensureStarted() {
    this.bindShutdown();

    for (const instance of listStoredInstances()) {
      await this.startInstance(instance);
    }
  }

  listInstances() {
    return listStoredInstances();
  }

  getInstance(id: string) {
    return getStoredInstance(id);
  }

  async createInstance(input: { directory: string; name?: string | null }) {
    const selection = validateFileSelection(input.directory, "directory");
    const instanceId = randomUUID();
    const name = input.name?.trim() || basename(selection.path);
    const stored = createStoredInstance({
      id: instanceId,
      name,
      directory: selection.path,
      port: 0,
      status: "starting",
    });

    if (!stored) {
      throw new Error("Failed to create the instance record.");
    }

    await this.startInstance(stored);

    return this.getInstanceOrThrow(instanceId);
  }

  async removeInstance(id: string) {
    this.getInstanceOrThrow(id);

    const managed = this.processes.get(id);

    if (managed) {
      this.processes.delete(id);
      await managed.stop();
    }

    deleteStoredInstance(id);
  }

  getInstanceOrThrow(id: string) {
    const instance = this.getInstance(id);

    if (!instance) {
      throw new Response("Instance not found.", { status: 404 });
    }

    return instance;
  }

  private bindShutdown() {
    if (this.shutdownBound) {
      return;
    }

    this.shutdownBound = true;

    const handleShutdown = async () => {
      this.isShuttingDown = true;
      await Promise.all([...this.processes.values()].map((managed) => managed.stop()));
      this.processes.clear();
    };

    process.once("exit", () => {
      this.isShuttingDown = true;
      for (const managed of this.processes.values()) {
        managed.child.kill("SIGTERM");
      }
      this.processes.clear();
    });
    process.once("SIGINT", () => {
      void handleShutdown().finally(() => process.exit(0));
    });
    process.once("SIGTERM", () => {
      void handleShutdown().finally(() => process.exit(0));
    });
  }

  private async startInstance(instance: InstanceRecord) {
    if (this.processes.has(instance.id)) {
      return this.getInstanceOrThrow(instance.id);
    }

    updateStoredInstance(instance.id, {
      status: "starting",
      lastError: null,
    });

    try {
      const managed = spawnInstanceProcess(instance);
      this.processes.set(instance.id, managed);
      const port = await managed.ready;

      updateStoredInstance(instance.id, {
        port,
        status: "running",
        lastStartedAt: new Date().toISOString(),
        lastError: null,
      });

      managed.child.once("error", (error) => {
        this.processes.delete(instance.id);
        updateStoredInstance(instance.id, {
          status: "error",
          lastExitAt: new Date().toISOString(),
          lastError: error.message,
        });
      });

      managed.child.once("exit", (code, signal) => {
        this.processes.delete(instance.id);

        if (this.isShuttingDown) {
          return;
        }

        updateStoredInstance(instance.id, {
          status: code === 0 || signal === "SIGTERM" ? "stopped" : "error",
          lastExitAt: new Date().toISOString(),
          lastError:
            code === 0 || signal === "SIGTERM"
              ? null
              : `Process exited with code ${code ?? "unknown"}${signal ? ` (${signal})` : ""}`,
        });
      });
    } catch (error) {
      console.error(
        `[instances] Failed to start "${instance.name}" in ${instance.directory}:`,
        error instanceof Error ? error.message : error,
      );

      updateStoredInstance(instance.id, {
        status: "error",
        lastExitAt: new Date().toISOString(),
        lastError: error instanceof Error ? error.message : "Failed to start Opencode.",
      });
    }

    return this.getInstanceOrThrow(instance.id);
  }
}

type RuntimeGlobal = typeof globalThis & {
  __scriptoriumInstanceRuntime?: InstanceRuntime;
  __scriptoriumInstanceRuntimeStart?: Promise<void>;
};

const runtimeGlobal = globalThis as RuntimeGlobal;

function getRuntimeSingleton() {
  if (!runtimeGlobal.__scriptoriumInstanceRuntime) {
    runtimeGlobal.__scriptoriumInstanceRuntime = new InstanceRuntime();
  }

  return runtimeGlobal.__scriptoriumInstanceRuntime;
}

async function getRuntime() {
  if (!runtimeGlobal.__scriptoriumInstanceRuntimeStart) {
    runtimeGlobal.__scriptoriumInstanceRuntimeStart = getRuntimeSingleton().ensureStarted();
  }

  await runtimeGlobal.__scriptoriumInstanceRuntimeStart;

  return getRuntimeSingleton();
}

export async function ensureStarted() {
  await getRuntime();
}

export async function listInstances() {
  return (await getRuntime()).listInstances();
}

export async function getInstanceOrThrow(id: string) {
  return (await getRuntime()).getInstanceOrThrow(id);
}

export async function createInstance(input: { directory: string; name?: string | null }) {
  return (await getRuntime()).createInstance(input);
}

export async function removeInstance(id: string) {
  return (await getRuntime()).removeInstance(id);
}
