import { execFileSync, spawnSync, type StdioOptions } from "node:child_process";

export function canExecute(command: string) {
  const result = spawnSync(command, ["version"], { stdio: "ignore" });
  const errorCode = (result.error as NodeJS.ErrnoException | undefined)?.code;

  return errorCode !== "ENOENT";
}

export function resolveTailscaleCommand() {
  if (canExecute("tailscale")) {
    return "tailscale";
  }

  if (canExecute("tailscale.exe")) {
    return "tailscale.exe";
  }

  return "tailscale";
}

export function runTailscale(args: string[], stdio: StdioOptions) {
  execFileSync(resolveTailscaleCommand(), args, { stdio });
}
