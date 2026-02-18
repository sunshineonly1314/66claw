import type { PluginRuntime } from "openclawcn/plugin-sdk";

let runtime: PluginRuntime | null = null;
let isInitialized = false;

export function setTelegramRuntime(next: PluginRuntime) {
  if (isInitialized && runtime !== null) {
    // Prevent accidental re-initialization
    console.warn("[Telegram] Runtime already initialized, ignoring duplicate call");
    return;
  }
  runtime = next;
  isInitialized = true;
}

export function getTelegramRuntime(): PluginRuntime {
  if (!runtime || !isInitialized) {
    throw new Error("Telegram runtime not initialized");
  }
  return runtime;
}
