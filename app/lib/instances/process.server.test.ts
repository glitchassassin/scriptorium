// @vitest-environment node

import { EventEmitter } from "node:events";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { InstanceRecord } from "~/lib/instances/types";
import { spawnInstanceProcess } from "~/lib/instances/process.server";

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

vi.mock("~/lib/runtime-config.server", () => ({
  getRuntimeConfiguration: () => ({
    config: {
      opencode: {
        bin: "opencode",
      },
    },
  }),
}));

const instance: InstanceRecord = {
  id: "instance-1",
  name: "test",
  directory: "/tmp/workspace",
  port: 0,
  status: "starting",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  lastStartedAt: null,
  lastExitAt: null,
  lastError: null,
};

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
  vi.clearAllMocks();
});

describe("spawnInstanceProcess", () => {
  it("spawns opencode without forwarding NODE_ENV", async () => {
    process.env.NODE_ENV = "production";
    process.env.SCRIPTORIUM_TEST_FLAG = "preserved";

    const child = createMockChildProcess();
    spawnMock.mockReturnValue(child);

    const managed = spawnInstanceProcess(instance);

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
