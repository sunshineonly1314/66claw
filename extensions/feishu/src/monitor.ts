/**
 * 飞书 WebSocket 监控
 * Feishu WebSocket Monitor
 *
 * 融合自 m1heng/clawdbot-feishu
 * 支持 WebSocket 长连接模式
 */

import type { ClawdbotConfig } from "openclawcn/plugin-sdk";
import type { FeishuChannelConfig, FeishuMessageEvent, FeishuBotAddedEvent } from "./types.js";
import { createFeishuWSClient, createEventDispatcher, resolveFeishuCredentials, Lark } from "./client.js";
import { probeFeishuConnection } from "./api.js";

// ============================================================================
// 类型定义
// ============================================================================

export interface MonitorFeishuOpts {
  config?: ClawdbotConfig;
  log?: (msg: string) => void;
  error?: (msg: string) => void;
  abortSignal?: AbortSignal;
  accountId?: string;
  onMessage?: (event: FeishuMessageEvent) => Promise<void>;
  onBotAdded?: (event: FeishuBotAddedEvent) => Promise<void>;
  onBotRemoved?: (event: { chat_id: string }) => Promise<void>;
}

// ============================================================================
// 状态管理 (实例级，支持多账号并发)
// ============================================================================

/**
 * 飞书监控实例上下文
 * 避免使用全局变量，支持多账号同时运行
 */
export interface FeishuMonitorInstance {
  wsClient: Lark.WSClient | null;
  botOpenId: string | undefined;
  accountId: string;
  isRunning: boolean;
  /** 实例停止时间戳，用于延迟清理 */
  stoppedAt?: number;
}

/** 实例停止后延迟清理时间：60 秒 */
const INSTANCE_CLEANUP_DELAY_MS = 60_000;

/**
 * 活跃的监控实例 Map<accountId, instance>
 * 允许同时运行多个飞书账号
 */
const activeInstances = new Map<string, FeishuMonitorInstance>();

/**
 * 获取机器人 open_id
 * 失败时记录日志而非静默吞掉错误
 */
async function fetchBotOpenId(
  cfg: FeishuChannelConfig,
  log?: (msg: string) => void,
): Promise<string | undefined> {
  try {
    const result = await probeFeishuConnection(cfg);
    if (!result.ok) {
      log?.(`[feishu] 获取机器人信息失败: ${result.error}`);
    }
    return result.ok ? result.botOpenId : undefined;
  } catch (err) {
    log?.(`[feishu] 获取机器人信息异常: ${String(err)}`);
    return undefined;
  }
}

/**
 * 获取指定账号的机器人 open_id
 */
export function getBotOpenId(accountId: string): string | undefined {
  return activeInstances.get(accountId)?.botOpenId;
}

/**
 * 获取当前机器人 open_id (兼容旧 API，返回第一个活跃实例)
 * @deprecated 推荐使用 getBotOpenId(accountId)
 */
export function getCurrentBotOpenId(): string | undefined {
  for (const instance of activeInstances.values()) {
    if (instance.botOpenId) return instance.botOpenId;
  }
  return undefined;
}

/**
 * 获取所有活跃实例
 */
export function getActiveInstances(): Map<string, FeishuMonitorInstance> {
  return new Map(activeInstances);
}

// ============================================================================
// WebSocket 监控
// ============================================================================

/**
 * 启动飞书 WebSocket 监控
 * 返回监控实例，支持多账号并发运行
 */
export async function monitorFeishuProvider(opts: MonitorFeishuOpts = {}): Promise<FeishuMonitorInstance> {
  const cfg = opts.config;
  if (!cfg) {
    throw new Error("Config is required for Feishu monitor");
  }

  const feishuCfg = cfg.channels?.feishu as FeishuChannelConfig | undefined;
  const creds = resolveFeishuCredentials(feishuCfg);
  if (!creds) {
    throw new Error("飞书凭证未配置 (需要 appId, appSecret)");
  }

  const log = opts.log ?? console.log;
  const error = opts.error ?? console.error;
  const accountId = opts.accountId ?? "default";

  // 创建实例状态
  const instance: FeishuMonitorInstance = {
    wsClient: null,
    botOpenId: undefined,
    accountId,
    isRunning: false,
  };

  // 注册实例
  activeInstances.set(accountId, instance);

  // 获取机器人 open_id（同时验证凭证有效性）
  if (feishuCfg) {
    instance.botOpenId = await fetchBotOpenId(feishuCfg, log);
    if (instance.botOpenId) {
      log(`[feishu][${accountId}] 机器人 open_id: ${instance.botOpenId}`);
    } else {
      error(`[feishu][${accountId}] 无法获取机器人信息，请检查 appId/appSecret 是否正确。WebSocket 连接仍将尝试启动。`);
    }
  }

  const connectionMode = feishuCfg?.connectionMode ?? "websocket";

  if (connectionMode === "websocket") {
    await monitorWebSocket({
      cfg,
      feishuCfg: feishuCfg!,
      log,
      error,
      abortSignal: opts.abortSignal,
      onMessage: opts.onMessage,
      onBotAdded: opts.onBotAdded,
      onBotRemoved: opts.onBotRemoved,
      instance,
    });
    return instance;
  }

  log("[feishu] Webhook 模式不在 monitor 中实现，请使用 HTTP 服务器");
  return instance;
}

/**
 * WebSocket 监控实现
 */
async function monitorWebSocket(params: {
  cfg: ClawdbotConfig;
  feishuCfg: FeishuChannelConfig;
  log: (msg: string) => void;
  error: (msg: string) => void;
  abortSignal?: AbortSignal;
  onMessage?: (event: FeishuMessageEvent) => Promise<void>;
  onBotAdded?: (event: FeishuBotAddedEvent) => Promise<void>;
  onBotRemoved?: (event: { chat_id: string }) => Promise<void>;
  instance: FeishuMonitorInstance;
}): Promise<void> {
  const { feishuCfg, log, error, abortSignal, onMessage, onBotAdded, onBotRemoved, instance } = params;
  const accountId = instance.accountId;

  log(`[feishu][${accountId}] 启动 WebSocket 连接...`);

  const wsClient = createFeishuWSClient(feishuCfg);
  instance.wsClient = wsClient;
  instance.isRunning = true;

  const eventDispatcher = createEventDispatcher(feishuCfg);

  // 注册事件处理器
  eventDispatcher.register({
    "im.message.receive_v1": async (data) => {
      try {
        const event = data as unknown as FeishuMessageEvent;
        log(`[feishu][${accountId}] 收到消息: chatId=${event.message.chat_id}, type=${event.message.message_type}`);
        if (onMessage) {
          await onMessage(event);
        }
      } catch (err) {
        error(`[feishu][${accountId}] 处理消息事件失败: ${String(err)}`);
      }
    },
    "im.message.message_read_v1": async () => {
      // 忽略已读回执
    },
    "im.chat.member.bot.added_v1": async (data) => {
      try {
        const event = data as unknown as FeishuBotAddedEvent;
        log(`[feishu][${accountId}] 机器人被添加到会话 ${event.chat_id}`);
        if (onBotAdded) {
          await onBotAdded(event);
        }
      } catch (err) {
        error(`[feishu][${accountId}] 处理机器人入群事件失败: ${String(err)}`);
      }
    },
    "im.chat.member.bot.deleted_v1": async (data) => {
      try {
        const event = data as unknown as { chat_id: string };
        log(`[feishu][${accountId}] 机器人被移出会话 ${event.chat_id}`);
        if (onBotRemoved) {
          await onBotRemoved(event);
        }
      } catch (err) {
        error(`[feishu][${accountId}] 处理机器人退群事件失败: ${String(err)}`);
      }
    },
  });

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      // Close the WSClient BEFORE nulling the reference.
      // WSClient.close() clears ping/reconnect timers, removes WS event
      // listeners (preventing reconnect-on-close), and terminates the
      // underlying WebSocket connection. Without this, the old WSClient
      // leaks timers and connections on every config hot-reload restart.
      try {
        wsClient.close({ force: true });
      } catch {
        // Defensive: SDK close() is synchronous and should not throw,
        // but guard against unexpected SDK versions / states.
      }
      instance.wsClient = null;
      instance.isRunning = false;
      instance.stoppedAt = Date.now();

      // 延迟清理：允许短暂查询状态后自动删除
      setTimeout(() => {
        const current = activeInstances.get(accountId);
        // 只有当实例仍是停止状态且未重启时才删除
        if (current === instance && !current.isRunning && current.stoppedAt) {
          activeInstances.delete(accountId);
        }
      }, INSTANCE_CLEANUP_DELAY_MS);
    };

    const handleAbort = () => {
      log(`[feishu][${accountId}] 收到中止信号，停止 WebSocket 客户端`);
      cleanup();
      resolve();
    };

    if (abortSignal?.aborted) {
      cleanup();
      resolve();
      return;
    }

    abortSignal?.addEventListener("abort", handleAbort, { once: true });

    try {
      wsClient.start({
        eventDispatcher,
      });

      log(`[feishu][${accountId}] WebSocket 客户端已启动`);
    } catch (err) {
      cleanup();
      abortSignal?.removeEventListener("abort", handleAbort);
      reject(err);
    }
  });
}

/**
 * 停止指定账号的飞书监控
 */
export function stopFeishuMonitor(accountId?: string): void {
  const closeInstance = (inst: FeishuMonitorInstance) => {
    try {
      inst.wsClient?.close({ force: true });
    } catch {
      // Defensive: guard against unexpected SDK states.
    }
    inst.wsClient = null;
    inst.isRunning = false;
  };

  if (accountId) {
    const instance = activeInstances.get(accountId);
    if (instance) {
      closeInstance(instance);
      activeInstances.delete(accountId);
    }
  } else {
    // 停止所有实例
    for (const [id, instance] of activeInstances) {
      closeInstance(instance);
      activeInstances.delete(id);
    }
  }
}

/**
 * 检查指定账号是否正在运行
 */
export function isFeishuMonitorRunning(accountId: string = "default"): boolean {
  return activeInstances.get(accountId)?.isRunning ?? false;
}
