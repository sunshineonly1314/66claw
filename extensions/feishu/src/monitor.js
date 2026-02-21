import { createFeishuWSClient, createEventDispatcher, resolveFeishuCredentials } from "./client.js";
import { probeFeishuConnection } from "./api.js";
const INSTANCE_CLEANUP_DELAY_MS = 6e4;
const activeInstances = /* @__PURE__ */ new Map();
async function fetchBotOpenId(cfg, log) {
  try {
    const result = await probeFeishuConnection(cfg);
    if (!result.ok) {
      log?.(`[feishu] \u83B7\u53D6\u673A\u5668\u4EBA\u4FE1\u606F\u5931\u8D25: ${result.error}`);
    }
    return result.ok ? result.botOpenId : void 0;
  } catch (err) {
    log?.(`[feishu] \u83B7\u53D6\u673A\u5668\u4EBA\u4FE1\u606F\u5F02\u5E38: ${String(err)}`);
    return void 0;
  }
}
function getBotOpenId(accountId) {
  return activeInstances.get(accountId)?.botOpenId;
}
function getCurrentBotOpenId() {
  for (const instance of activeInstances.values()) {
    if (instance.botOpenId) return instance.botOpenId;
  }
  return void 0;
}
function getActiveInstances() {
  return new Map(activeInstances);
}
async function monitorFeishuProvider(opts = {}) {
  const cfg = opts.config;
  if (!cfg) {
    throw new Error("Config is required for Feishu monitor");
  }
  const feishuCfg = cfg.channels?.feishu;
  const creds = resolveFeishuCredentials(feishuCfg);
  if (!creds) {
    throw new Error("\u98DE\u4E66\u51ED\u8BC1\u672A\u914D\u7F6E (\u9700\u8981 appId, appSecret)");
  }
  const log = opts.log ?? console.log;
  const error = opts.error ?? console.error;
  const accountId = opts.accountId ?? "default";
  const instance = {
    wsClient: null,
    botOpenId: void 0,
    accountId,
    isRunning: false
  };
  activeInstances.set(accountId, instance);
  if (feishuCfg) {
    instance.botOpenId = await fetchBotOpenId(feishuCfg, log);
    if (instance.botOpenId) {
      log(`[feishu][${accountId}] \u673A\u5668\u4EBA open_id: ${instance.botOpenId}`);
    } else {
      error(`[feishu][${accountId}] \u65E0\u6CD5\u83B7\u53D6\u673A\u5668\u4EBA\u4FE1\u606F\uFF0C\u8BF7\u68C0\u67E5 appId/appSecret \u662F\u5426\u6B63\u786E\u3002WebSocket \u8FDE\u63A5\u4ECD\u5C06\u5C1D\u8BD5\u542F\u52A8\u3002`);
    }
  }
  const connectionMode = feishuCfg?.connectionMode ?? "websocket";
  if (connectionMode === "websocket") {
    await monitorWebSocket({
      cfg,
      feishuCfg,
      log,
      error,
      abortSignal: opts.abortSignal,
      onMessage: opts.onMessage,
      onBotAdded: opts.onBotAdded,
      onBotRemoved: opts.onBotRemoved,
      instance
    });
    return instance;
  }
  log("[feishu] Webhook \u6A21\u5F0F\u4E0D\u5728 monitor \u4E2D\u5B9E\u73B0\uFF0C\u8BF7\u4F7F\u7528 HTTP \u670D\u52A1\u5668");
  return instance;
}
async function monitorWebSocket(params) {
  const { feishuCfg, log, error, abortSignal, onMessage, onBotAdded, onBotRemoved, instance } = params;
  const accountId = instance.accountId;
  log(`[feishu][${accountId}] \u542F\u52A8 WebSocket \u8FDE\u63A5...`);
  const wsClient = createFeishuWSClient(feishuCfg);
  instance.wsClient = wsClient;
  instance.isRunning = true;
  const eventDispatcher = createEventDispatcher(feishuCfg);
  eventDispatcher.register({
    "im.message.receive_v1": async (data) => {
      try {
        const event = data;
        log(`[feishu][${accountId}] \u6536\u5230\u6D88\u606F: chatId=${event.message.chat_id}, type=${event.message.message_type}`);
        if (onMessage) {
          await onMessage(event);
        }
      } catch (err) {
        error(`[feishu][${accountId}] \u5904\u7406\u6D88\u606F\u4E8B\u4EF6\u5931\u8D25: ${String(err)}`);
      }
    },
    "im.message.message_read_v1": async () => {
    },
    "im.chat.member.bot.added_v1": async (data) => {
      try {
        const event = data;
        log(`[feishu][${accountId}] \u673A\u5668\u4EBA\u88AB\u6DFB\u52A0\u5230\u4F1A\u8BDD ${event.chat_id}`);
        if (onBotAdded) {
          await onBotAdded(event);
        }
      } catch (err) {
        error(`[feishu][${accountId}] \u5904\u7406\u673A\u5668\u4EBA\u5165\u7FA4\u4E8B\u4EF6\u5931\u8D25: ${String(err)}`);
      }
    },
    "im.chat.member.bot.deleted_v1": async (data) => {
      try {
        const event = data;
        log(`[feishu][${accountId}] \u673A\u5668\u4EBA\u88AB\u79FB\u51FA\u4F1A\u8BDD ${event.chat_id}`);
        if (onBotRemoved) {
          await onBotRemoved(event);
        }
      } catch (err) {
        error(`[feishu][${accountId}] \u5904\u7406\u673A\u5668\u4EBA\u9000\u7FA4\u4E8B\u4EF6\u5931\u8D25: ${String(err)}`);
      }
    }
  });
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      instance.wsClient = null;
      instance.isRunning = false;
      instance.stoppedAt = Date.now();
      setTimeout(() => {
        const current = activeInstances.get(accountId);
        if (current === instance && !current.isRunning && current.stoppedAt) {
          activeInstances.delete(accountId);
        }
      }, INSTANCE_CLEANUP_DELAY_MS);
    };
    const handleAbort = () => {
      log(`[feishu][${accountId}] \u6536\u5230\u4E2D\u6B62\u4FE1\u53F7\uFF0C\u505C\u6B62 WebSocket \u5BA2\u6237\u7AEF`);
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
        eventDispatcher
      });
      log(`[feishu][${accountId}] WebSocket \u5BA2\u6237\u7AEF\u5DF2\u542F\u52A8`);
    } catch (err) {
      cleanup();
      abortSignal?.removeEventListener("abort", handleAbort);
      reject(err);
    }
  });
}
function stopFeishuMonitor(accountId) {
  if (accountId) {
    const instance = activeInstances.get(accountId);
    if (instance) {
      instance.wsClient = null;
      instance.isRunning = false;
      activeInstances.delete(accountId);
    }
  } else {
    for (const [id, instance] of activeInstances) {
      instance.wsClient = null;
      instance.isRunning = false;
      activeInstances.delete(id);
    }
  }
}
function isFeishuMonitorRunning(accountId = "default") {
  return activeInstances.get(accountId)?.isRunning ?? false;
}
export {
  getActiveInstances,
  getBotOpenId,
  getCurrentBotOpenId,
  isFeishuMonitorRunning,
  monitorFeishuProvider,
  stopFeishuMonitor
};
