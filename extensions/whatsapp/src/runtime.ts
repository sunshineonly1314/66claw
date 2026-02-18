import type { PluginRuntime } from "openclawcn/plugin-sdk";

let runtime: PluginRuntime | null = null;
let isInitialized = false;

export function setWhatsAppRuntime(next: PluginRuntime) {
  if (isInitialized && runtime !== null) {
    // Prevent accidental re-initialization
    console.warn("[WhatsApp] Runtime already initialized, ignoring duplicate call");
    return;
  }
  runtime = next;
  isInitialized = true;
}

export function getWhatsAppRuntime(): PluginRuntime {
  if (!runtime || !isInitialized) {
    throw new Error("WhatsApp runtime not initialized");
  }
  return runtime;
}
