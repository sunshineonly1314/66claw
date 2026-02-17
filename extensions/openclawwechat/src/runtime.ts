/**
 * 微信小程序运行时
 * WeChat MiniProgram Runtime
 */

import type { PluginRuntime } from "openclawcn/plugin-sdk";

let wechatRuntime: PluginRuntime | null = null;

export function setWechatMiniprogramRuntime(runtime: PluginRuntime): void {
  wechatRuntime = runtime;
}

export function getWechatMiniprogramRuntime(): PluginRuntime {
  if (!wechatRuntime) {
    throw new Error("WeChat MiniProgram runtime not initialized");
  }
  return wechatRuntime;
}
