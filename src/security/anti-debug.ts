/**
 * Clawdbot Security Module - Anti-Debug Detection
 * 反调试检测
 *
 * 检测是否在调试环境中运行，防止动态分析攻击
 * 仅在生产构建中启用
 */

import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("security:anti-debug");

/**
 * 反调试配置
 */
export interface AntiDebugConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 检测间隔（毫秒） */
  checkIntervalMs: number;
  /** 检测到调试器时的回调 */
  onDebuggerDetected?: () => void;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: AntiDebugConfig = {
  enabled: true,
  checkIntervalMs: 10000, // 10 秒
};

/**
 * 检测间隔定时器
 */
let checkInterval: ReturnType<typeof setInterval> | null = null;

/**
 * 检测是否在调试模式
 */
function detectDebugger(): boolean {
  // 方法 1：检测 Node.js 调试参数
  const debugArgs = ["--inspect", "--inspect-brk", "--debug", "--debug-brk"];
  const hasDebugArg = process.execArgv.some((arg) =>
    debugArgs.some((d) => arg.includes(d)),
  );

  if (hasDebugArg) {
    log.debug("Debugger detected: debug argument in execArgv");
    return true;
  }

  // 方法 2：检测调试环境变量
  const debugEnvs = ["NODE_OPTIONS", "NODE_INSPECT"];
  for (const env of debugEnvs) {
    const value = process.env[env];
    if (value && (value.includes("inspect") || value.includes("debug"))) {
      log.debug(`Debugger detected: ${env} contains debug flag`);
      return true;
    }
  }

  // 方法 3：检测 v8 调试对象
  // @ts-expect-error - v8debug 是运行时调试对象
  if (typeof v8debug !== "undefined") {
    log.debug("Debugger detected: v8debug object exists");
    return true;
  }

  // 方法 4：检测 inspector 模块是否活跃
  try {
    // 动态导入避免在非调试环境下加载
    const inspector = require("node:inspector");
    if (inspector.url()) {
      log.debug("Debugger detected: inspector URL exists");
      return true;
    }
  } catch {
    // inspector 模块不可用，忽略
  }

  return false;
}

/**
 * 处理检测到调试器
 */
function handleDebuggerDetected(config: AntiDebugConfig): void {
  log.warn("Debugger detected, taking action");

  // 调用自定义回调
  if (config.onDebuggerDetected) {
    config.onDebuggerDetected();
  }

  // 清理敏感环境变量
  const sensitiveEnvs = ["LICENSE_KEY", "CLAWDBOT_LICENSE_KEY"];
  for (const env of sensitiveEnvs) {
    if (process.env[env]) {
      process.env[env] = "";
    }
  }

  // 退出程序
  console.error("[安全] 检测到调试环境，程序退出");
  process.exit(1);
}

/**
 * 判断是否为生产环境
 */
function isProduction(): boolean {
  // 使用编译时常量（与 DEV 绕过相同的机制）
  // 安全检查：如果 __DEV_BUILD__ 未定义，视为生产环境
  const isDevBuild = typeof __DEV_BUILD__ !== "undefined" && __DEV_BUILD__;

  // 生产构建：__DEV_BUILD__ = false 或未定义
  if (!isDevBuild) {
    return true;
  }

  // 开发构建时，检查 NODE_ENV
  return process.env.NODE_ENV === "production";
}

/**
 * 启动反调试检测
 *
 * @param config - 配置选项
 */
export function startAntiDebug(config: Partial<AntiDebugConfig> = {}): void {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // 非生产环境不启用
  if (!isProduction()) {
    log.debug("Anti-debug disabled in non-production environment");
    return;
  }

  if (!finalConfig.enabled) {
    log.debug("Anti-debug disabled by config");
    return;
  }

  log.debug("Starting anti-debug detection");

  // 立即检测一次
  if (detectDebugger()) {
    handleDebuggerDetected(finalConfig);
    return;
  }

  // 定期检测
  checkInterval = setInterval(() => {
    if (detectDebugger()) {
      handleDebuggerDetected(finalConfig);
    }
  }, finalConfig.checkIntervalMs);

  // 不阻止进程退出
  checkInterval.unref();
}

/**
 * 停止反调试检测
 */
export function stopAntiDebug(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    log.debug("Anti-debug detection stopped");
  }
}

/**
 * 手动触发一次检测
 */
export function checkDebuggerNow(): boolean {
  return detectDebugger();
}
