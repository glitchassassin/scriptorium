// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
  spawnSync: vi.fn(),
}));

import { execFileSync, spawnSync } from "node:child_process";

import { canExecute, resolveTailscaleCommand, runTailscale } from "./tailscale.js";

function spawnResult(error?: NodeJS.ErrnoException) {
  return {
    error,
  } as unknown as ReturnType<typeof spawnSync>;
}

function enoentError(): NodeJS.ErrnoException {
  return {
    code: "ENOENT",
    message: "not found",
    name: "Error",
  };
}

describe("tailscale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports whether a command is executable", () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce(spawnResult())
      .mockReturnValueOnce(spawnResult(enoentError()));

    expect(canExecute("tailscale")).toBe(true);
    expect(canExecute("tailscale.exe")).toBe(false);
  });

  it("falls back to tailscale.exe when tailscale is missing", () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce(spawnResult(enoentError()))
      .mockReturnValueOnce(spawnResult());

    expect(resolveTailscaleCommand()).toBe("tailscale.exe");
  });

  it("defaults to tailscale when neither executable is found", () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce(spawnResult(enoentError()))
      .mockReturnValueOnce(spawnResult(enoentError()));

    expect(resolveTailscaleCommand()).toBe("tailscale");
  });

  it("runs tailscale with the resolved executable", () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce(spawnResult(enoentError()))
      .mockReturnValueOnce(spawnResult());

    runTailscale(["serve", "--bg", "http://localhost:6200"], "inherit");

    expect(execFileSync).toHaveBeenCalledWith(
      "tailscale.exe",
      ["serve", "--bg", "http://localhost:6200"],
      { stdio: "inherit" },
    );
  });
});
