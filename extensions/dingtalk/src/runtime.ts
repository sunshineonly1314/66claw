import type { PluginRuntime } from "clawdbot/plugin-sdk";

let dingtalkRuntime: PluginRuntime | null = null;

export function setDingtalkRuntime(runtime: PluginRuntime): void {
  dingtalkRuntime = runtime;
}

export function getDingtalkRuntime(): PluginRuntime {
  if (!dingtalkRuntime) {
    throw new Error("DingTalk runtime not initialized");
  }
  return dingtalkRuntime;
}
