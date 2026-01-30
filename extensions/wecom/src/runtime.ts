/**
 * 企业微信运行时
 * WeCom Runtime
 */

import type { PluginRuntime } from "clawdbot/plugin-sdk";

let wecomRuntime: PluginRuntime | null = null;

export function setWecomRuntime(runtime: PluginRuntime): void {
  wecomRuntime = runtime;
}

export function getWecomRuntime(): PluginRuntime {
  if (!wecomRuntime) {
    throw new Error("WeCom runtime not initialized");
  }
  return wecomRuntime;
}
