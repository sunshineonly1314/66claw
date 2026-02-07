/**
 * QQ 机器人 Runtime 管理
 * QQ Bot Runtime Management
 */

import type { PluginRuntime } from "clawdbot/plugin-sdk";

let qqbotRuntime: PluginRuntime | null = null;

export function setQqbotRuntime(runtime: PluginRuntime): void {
  qqbotRuntime = runtime;
}

export function getQqbotRuntime(): PluginRuntime {
  if (!qqbotRuntime) {
    throw new Error("QQ Bot runtime not initialized");
  }
  return qqbotRuntime;
}
