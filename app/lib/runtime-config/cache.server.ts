import { resolveRuntimeConfiguration } from "./loader.server.ts";
import type { OverrideSources, RuntimeConfiguration } from "./schema.server.ts";

let cachedRuntimeConfiguration: RuntimeConfiguration | null = null;

export function getRuntimeConfiguration() {
  if (!cachedRuntimeConfiguration) {
    cachedRuntimeConfiguration = resolveRuntimeConfiguration({ env: process.env });
  }

  return cachedRuntimeConfiguration;
}

export function initializeRuntimeConfiguration(sources: OverrideSources = {}) {
  cachedRuntimeConfiguration = resolveRuntimeConfiguration(sources);
  return cachedRuntimeConfiguration;
}

export function resetRuntimeConfigurationCache() {
  cachedRuntimeConfiguration = null;
}
