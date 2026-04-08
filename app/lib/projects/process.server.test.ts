// @vitest-environment node

import { EventEmitter } from "node:events";

import { afterEach, describe, expect, it, vi } from "vitest";

import { invalidateOpencodeVersionCache, readOpencodeVersion, spawnOpencodeServeProcess } from "~/lib/projects/process.server";

const { spawnMock, spawnSyncMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  spawnSyncMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
  spawnSync: spawnSyncMock,
}));

vi.mock("~/lib/runtime-config/cache.server", () => ({
  getRuntimeConfiguration: () => ({
    config: {
      opencode: {
        bin: "opencode",
      },
    },
  }),
}));

function createMockChildProcess() {
  const stdout = new EventEmitter() as EventEmitter & { setEncoding: ReturnType<typeof vi.fn> };
  const stderr = new EventEmitter() as EventEmitter & { setEncoding: ReturnType<typeof vi.fn> };

  stdout.setEncoding = vi.fn();
  stderr.setEncoding = vi.fn();

  return Object.assign(new EventEmitter(), {
    stdout,
    stderr,
    exitCode: null,
    killed: false,
    kill: vi.fn(() => true),
  });
}

afterEach(() => {
  delete process.env.NODE_ENV;
  delete process.env.SCRIPTORIUM_TEST_FLAG;
  invalidateOpencodeVersionCache();
  vi.clearAllMocks();
});

describe("spawnOpencodeServeProcess", () => {
  it("spawns opencode without forwarding NODE_ENV", async () => {
    process.env.NODE_ENV = "production";
    process.env.SCRIPTORIUM_TEST_FLAG = "preserved";

    const child = createMockChildProcess();
    spawnMock.mockReturnValue(child);

    const managed = spawnOpencodeServeProcess({
      cwd: "/tmp/workspace",
      label: "test",
    });

    expect(spawnMock).toHaveBeenCalledWith(
      "opencode",
      ["serve"],
      expect.objectContaining({
        cwd: "/tmp/workspace",
        stdio: ["ignore", "pipe", "pipe"],
        env: expect.objectContaining({
          SCRIPTORIUM_TEST_FLAG: "preserved",
        }),
      }),
    );

    const spawnOptions = spawnMock.mock.calls[0]?.[2];

    expect(spawnOptions?.env.NODE_ENV).toBeUndefined();

    child.stdout.emit("data", "opencode server listening on http://127.0.0.1:4321");

    await expect(managed.ready).resolves.toBe(4321);
  });
});

describe("readOpencodeVersion", () => {
  it("reads the CLI version without forwarding NODE_ENV", () => {
    process.env.NODE_ENV = "production";
    process.env.SCRIPTORIUM_TEST_FLAG = "preserved";
    spawnSyncMock.mockReturnValue({
      error: undefined,
      status: 0,
      stdout: "1.4.0\n",
      stderr: "",
    });

    expect(readOpencodeVersion()).toBe("1.4.0");
    expect(spawnSyncMock).toHaveBeenCalledWith(
      "opencode",
      ["--version"],
      expect.objectContaining({
        env: expect.objectContaining({
          SCRIPTORIUM_TEST_FLAG: "preserved",
        }),
        timeout: 5000,
      }),
    );

    const spawnOptions = spawnSyncMock.mock.calls[0]?.[2];

    expect(spawnOptions?.env.NODE_ENV).toBeUndefined();
  });

  it("caches the CLI version between reads", () => {
    spawnSyncMock.mockReturnValue({
      error: undefined,
      status: 0,
      stdout: "1.4.0\n",
      stderr: "",
    });

    expect(readOpencodeVersion()).toBe("1.4.0");
    expect(readOpencodeVersion()).toBe("1.4.0");
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
  });
});
