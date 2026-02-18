import type { PluginRuntime } from "openclawcn/plugin-sdk";

let runtime: PluginRuntime | null = null;
let isInitialized = false;

export function setSlackRuntime(next: PluginRuntime) {
  if (isInitialized && runtime !== null) {
    // Prevent accidental re-initialization
    console.warn("[Slack] Runtime already initialized, ignoring duplicate call");
    return;
  }
  runtime = next;
  isInitialized = true;
}

export function getSlackRuntime(): PluginRuntime {
  if (!runtime || !isInitialized) {
    throw new Error("Slack runtime not initialized");
  }
  return runtime;
}
