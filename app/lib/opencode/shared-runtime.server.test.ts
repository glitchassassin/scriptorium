// @vitest-environment node

import { EventEmitter } from "node:events";

import { afterEach, describe, expect, it, vi } from "vitest";

const { invalidateOpencodeVersionCacheMock, readOpencodeVersionMock, runtimeConfig, spawnOpencodeServeProcessMock } = vi.hoisted(() => ({
  invalidateOpencodeVersionCacheMock: vi.fn(),
  readOpencodeVersionMock: vi.fn(),
  runtimeConfig: {
    config: {
      opencode: {
        bin: "opencode",
        url: undefined as string | undefined,
      },
      workspace: {
        browserRoot: "/tmp/workspace",
      },
    },
  },
  spawnOpencodeServeProcessMock: vi.fn(),
}));

vi.mock("~/lib/runtime-config/cache.server", () => ({
  getRuntimeConfiguration: () => runtimeConfig,
}));

vi.mock("~/lib/projects/process.server", () => ({
  invalidateOpencodeVersionCache: (...args: unknown[]) => invalidateOpencodeVersionCacheMock(...args),
  readOpencodeVersion: (...args: unknown[]) => readOpencodeVersionMock(...args),
  spawnOpencodeServeProcess: (...args: unknown[]) => spawnOpencodeServeProcessMock(...args),
}));

import {
  ensureSharedOpencodeServerStarted,
  getSharedOpencodeRuntimeState,
  getSharedOpencodeRuntimeStatus,
  getRunningSharedOpencodeServerUrl,
  restartSharedOpencodeServer,
  updateSharedOpencodeServer,
} from "~/lib/opencode/shared-runtime.server";

type SharedRuntimeTestGlobal = typeof globalThis & {
  __scriptoriumSharedOpencodeRuntime?: unknown;
};

function createManagedProcess(
  port: number,
  overrides: {
    ready?: Promise<number>;
    stop?: () => Promise<void>;
  } = {},
) {
  const child = Object.assign(new EventEmitter(), {
    kill: vi.fn(() => true),
  });
  const stop = vi.fn(overrides.stop ?? (async () => {
    child.emit("exit", 0, "SIGTERM");
  }));

  return {
    child,
    ready: overrides.ready ?? Promise.resolve(port),
    stop,
  };
}

afterEach(() => {
  delete (globalThis as SharedRuntimeTestGlobal).__scriptoriumSharedOpencodeRuntime;
  runtimeConfig.config.opencode.url = undefined;
  runtimeConfig.config.workspace.browserRoot = "/tmp/workspace";
  invalidateOpencodeVersionCacheMock.mockReset();
  readOpencodeVersionMock.mockReset();
  spawnOpencodeServeProcessMock.mockReset();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("shared OpenCode runtime", () => {
  it("reports externally managed state without spawning a local process", async () => {
    runtimeConfig.config.opencode.url = "http://127.0.0.1:44556";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ version: "1.4.0" })));

    expect(getSharedOpencodeRuntimeState()).toEqual({
      mode: "external",
      serverUrl: "http://127.0.0.1:44556",
    });
    expect(getRunningSharedOpencodeServerUrl()).toBe("http://127.0.0.1:44556");
    await expect(getSharedOpencodeRuntimeStatus()).resolves.toEqual({
      activeSince: null,
      error: null,
      installedVersion: null,
      isRunning: true,
      mode: "external",
      restartRequired: false,
      runningVersion: "1.4.0",
      serverUrl: "http://127.0.0.1:44556",
    });
    expect(spawnOpencodeServeProcessMock).not.toHaveBeenCalled();
    expect(readOpencodeVersionMock).not.toHaveBeenCalled();
  });

  it("reports unreachable externally managed servers as unavailable", async () => {
    runtimeConfig.config.opencode.url = "http://127.0.0.1:44556";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("connect ECONNREFUSED"));

    await expect(getSharedOpencodeRuntimeStatus()).resolves.toEqual({
      activeSince: null,
      error: "Configured OpenCode server is unavailable.",
      installedVersion: null,
      isRunning: false,
      mode: "external",
      restartRequired: false,
      runningVersion: null,
      serverUrl: "http://127.0.0.1:44556",
    });
  });

  it("reports installed version without starting the managed runtime", async () => {
    readOpencodeVersionMock.mockReturnValue("1.4.0");

    await expect(getSharedOpencodeRuntimeStatus()).resolves.toEqual({
      activeSince: null,
      error: null,
      installedVersion: "1.4.0",
      isRunning: false,
      mode: "managed",
      restartRequired: false,
      runningVersion: null,
      serverUrl: null,
    });

    expect(readOpencodeVersionMock).toHaveBeenCalledTimes(1);
    expect(spawnOpencodeServeProcessMock).not.toHaveBeenCalled();
  });

  it("reports managed runtime drift when the installed version changes", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const managed = createManagedProcess(4100);

    spawnOpencodeServeProcessMock.mockReturnValue(managed);
    readOpencodeVersionMock.mockReturnValue("1.4.0");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ healthy: true, version: "1.3.0" })));

    await expect(ensureSharedOpencodeServerStarted()).resolves.toBe(true);
    await expect(getSharedOpencodeRuntimeStatus()).resolves.toEqual({
      activeSince: 1_000_000,
      error: null,
      installedVersion: "1.4.0",
      isRunning: true,
      mode: "managed",
      restartRequired: true,
      runningVersion: "1.3.0",
      serverUrl: "http://127.0.0.1:4100",
    });

    expect(now).toHaveBeenCalled();
  });

  it("restarts the managed shared process and updates the active server URL", async () => {
    const first = createManagedProcess(4100);
    const second = createManagedProcess(4200);

    spawnOpencodeServeProcessMock
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ healthy: true, version: "1.4.0" })));

    await expect(ensureSharedOpencodeServerStarted()).resolves.toBe(true);
    expect(getRunningSharedOpencodeServerUrl()).toBe("http://127.0.0.1:4100");
    await expect(restartSharedOpencodeServer()).resolves.toBe("http://127.0.0.1:4200");

    expect(first.stop).toHaveBeenCalledTimes(1);
    expect(spawnOpencodeServeProcessMock).toHaveBeenCalledTimes(2);
    expect(getRunningSharedOpencodeServerUrl()).toBe("http://127.0.0.1:4200");
  });

  it("deduplicates concurrent restart requests", async () => {
    const first = createManagedProcess(4100);
    let resolveReady = (_port: number) => {};
    const second = createManagedProcess(4200, {
      ready: new Promise<number>((resolve) => {
        resolveReady = resolve;
      }),
    });

    spawnOpencodeServeProcessMock
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ healthy: true, version: "1.4.0" })));

    await expect(ensureSharedOpencodeServerStarted()).resolves.toBe(true);

    const firstRestart = restartSharedOpencodeServer();
    const secondRestart = restartSharedOpencodeServer();

    resolveReady(4200);

    await expect(Promise.all([firstRestart, secondRestart])).resolves.toEqual([
      "http://127.0.0.1:4200",
      "http://127.0.0.1:4200",
    ]);

    expect(first.stop).toHaveBeenCalledTimes(1);
    expect(spawnOpencodeServeProcessMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the replacement server active when the old process exits late", async () => {
    const first = createManagedProcess(4100, {
      stop: async () => {},
    });
    const second = createManagedProcess(4200);

    spawnOpencodeServeProcessMock
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ healthy: true, version: "1.4.0" })));

    await expect(ensureSharedOpencodeServerStarted()).resolves.toBe(true);
    await expect(restartSharedOpencodeServer()).resolves.toBe("http://127.0.0.1:4200");

    first.child.emit("exit", 0, "SIGTERM");

    expect(getRunningSharedOpencodeServerUrl()).toBe("http://127.0.0.1:4200");
  });

  it("updates the running managed server through the OpenCode API", async () => {
    const managed = createManagedProcess(4100);

    spawnOpencodeServeProcessMock.mockReturnValue(managed);
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ healthy: true, version: "1.4.0" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, version: "1.4.0" })));

    await expect(ensureSharedOpencodeServerStarted()).resolves.toBe(true);
    await expect(updateSharedOpencodeServer()).resolves.toBe("1.4.0");
    expect(invalidateOpencodeVersionCacheMock).toHaveBeenCalledTimes(1);
  });
});
