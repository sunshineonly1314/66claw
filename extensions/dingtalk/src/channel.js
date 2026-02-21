import {
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  PAIRING_APPROVED_MESSAGE,
  registerPluginHttpRoute
} from "openclawcn/plugin-sdk";
import { getDingtalkRuntime } from "./runtime.js";
import { sendDingtalkMessage, sendDingtalkMessageViaWebhook, probeDingtalkConnection } from "./api.js";
import { createDingtalkWebhookHandler } from "./webhook.js";
import { createStreamClient } from "./stream-client.js";
import { DingtalkConfigSchema } from "./config-schema.js";
const DINGTALK_CHANNEL_ID = "dingtalk";
const DEFAULT_WEBHOOK_PATH = "/dingtalk/webhook";
const SESSION_WEBHOOK_CACHE_MAX = 5e3;
const sessionWebhookCache = /* @__PURE__ */ new Map();
const meta = {
  id: DINGTALK_CHANNEL_ID,
  label: "\u9489\u9489",
  selectionLabel: "\u9489\u9489 (DingTalk)",
  docsPath: "/channels/dingtalk",
  docsLabel: "dingtalk",
  blurb: "\u9489\u9489\u4F01\u4E1A\u5185\u90E8\u5E94\u7528\u673A\u5668\u4EBA - \u652F\u6301 Webhook \u548C Stream \u53CC\u6A21\u5F0F",
  aliases: ["ding", "dingtalk"],
  order: -3
  // 国内渠道优先：飞书 > 钉钉 > 企业微信 > QQ > 其他...
};
function getConnectionMode(config) {
  return config?.mode || "stream";
}
function resolveDingtalkAccount(params) {
  const { cfg, accountId } = params;
  const resolvedAccountId = accountId ?? DEFAULT_ACCOUNT_ID;
  const channelConfig = cfg.channels?.dingtalk;
  const appKey = channelConfig?.app?.appKey ?? null;
  const appSecret = channelConfig?.app?.appSecret ?? null;
  const robotCode = channelConfig?.app?.robotCode ?? null;
  return {
    accountId: resolvedAccountId,
    enabled: channelConfig?.enabled !== false,
    configured: Boolean(appKey && appSecret),
    appKey,
    appSecret,
    robotCode,
    config: channelConfig ?? {}
  };
}
function resolveDingtalkCredentials(config) {
  return {
    appKey: config?.app?.appKey ?? null,
    appSecret: config?.app?.appSecret ?? null,
    robotCode: config?.app?.robotCode ?? null
  };
}
function getCachedSessionWebhook(conversationId) {
  const cached = sessionWebhookCache.get(conversationId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.webhook;
  }
  sessionWebhookCache.delete(conversationId);
  return null;
}
function cacheSessionWebhook(conversationId, webhook, expiresAt) {
  if (sessionWebhookCache.size >= SESSION_WEBHOOK_CACHE_MAX) {
    const now = Date.now();
    for (const [id, entry] of sessionWebhookCache) {
      if (entry.expiresAt <= now) {
        sessionWebhookCache.delete(id);
      }
    }
    if (sessionWebhookCache.size >= SESSION_WEBHOOK_CACHE_MAX) {
      const sorted = Array.from(sessionWebhookCache.entries()).sort((a, b) => a[1].expiresAt - b[1].expiresAt);
      const toRemove = Math.ceil(SESSION_WEBHOOK_CACHE_MAX * 0.2);
      for (let i = 0; i < toRemove && i < sorted.length; i++) {
        sessionWebhookCache.delete(sorted[i][0]);
      }
    }
  }
  sessionWebhookCache.set(conversationId, { webhook, expiresAt });
}
const dingtalkPlugin = {
  id: DINGTALK_CHANNEL_ID,
  meta: {
    ...meta,
    aliases: [...meta.aliases]
  },
  pairing: {
    idLabel: "dingtalkUserId",
    normalizeAllowEntry: (entry) => entry.replace(/^(dingtalk|ding):/i, ""),
    notifyApproval: async ({ cfg, id }) => {
      const channelConfig = cfg.channels?.dingtalk;
      await sendDingtalkMessage(channelConfig, [id], PAIRING_APPROVED_MESSAGE);
    }
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true
  },
  reload: { configPrefixes: ["channels.dingtalk"] },
  configSchema: buildChannelConfigSchema(DingtalkConfigSchema),
  config: {
    listAccountIds: () => [DEFAULT_ACCOUNT_ID],
    resolveAccount: (cfg, accountId) => resolveDingtalkAccount({ cfg, accountId }),
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    setAccountEnabled: ({ cfg, enabled }) => ({
      ...cfg,
      channels: {
        ...cfg.channels,
        dingtalk: {
          ...cfg.channels?.dingtalk,
          enabled
        }
      }
    }),
    deleteAccount: ({ cfg }) => {
      const next = { ...cfg };
      const nextChannels = { ...cfg.channels };
      delete nextChannels.dingtalk;
      if (Object.keys(nextChannels).length > 0) {
        next.channels = nextChannels;
      } else {
        delete next.channels;
      }
      return next;
    },
    isConfigured: (_account, cfg) => {
      const { appKey, appSecret } = resolveDingtalkCredentials(cfg.channels?.dingtalk);
      return Boolean(appKey && appSecret);
    },
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured
    }),
    resolveAllowFrom: ({ cfg }) => cfg.channels?.dingtalk?.allowFrom ?? [],
    formatAllowFrom: ({ allowFrom }) => allowFrom.map((entry) => String(entry).trim()).filter(Boolean).map((entry) => entry.toLowerCase())
  },
  security: {
    collectWarnings: ({ cfg }) => {
      const channelConfig = cfg.channels?.dingtalk;
      const defaultGroupPolicy = cfg.channels?.defaults?.groupPolicy;
      const groupPolicy = channelConfig?.groupPolicy ?? defaultGroupPolicy ?? "allowlist";
      if (groupPolicy !== "open") return [];
      return [
        `- \u9489\u9489\u7FA4\u804A: groupPolicy="open" \u5141\u8BB8\u4EFB\u4F55\u7FA4\u6210\u5458\u89E6\u53D1 (\u9700\u8981 @\u673A\u5668\u4EBA)\u3002\u8BBE\u7F6E channels.dingtalk.groupPolicy="allowlist" + channels.dingtalk.groups \u6765\u9650\u5236\u3002`
      ];
    }
  },
  messaging: {
    normalizeTarget: (raw) => {
      const trimmed = raw.trim();
      if (!trimmed) return void 0;
      return trimmed;
    },
    targetResolver: {
      looksLikeId: (raw) => {
        const trimmed = raw.trim();
        return trimmed.length > 0 && /^[a-zA-Z0-9$_-]+$/.test(trimmed);
      },
      hint: "<conversationId|staffId>"
    }
  },
  directory: {
    self: async () => null,
    listPeers: async ({ cfg, query, limit }) => {
      const q = query?.trim().toLowerCase() || "";
      const channelConfig = cfg.channels?.dingtalk;
      const ids = /* @__PURE__ */ new Set();
      for (const entry of channelConfig?.allowFrom ?? []) {
        const trimmed = String(entry).trim();
        if (trimmed && trimmed !== "*") ids.add(trimmed);
      }
      return Array.from(ids).filter((id) => q ? id.toLowerCase().includes(q) : true).slice(0, limit && limit > 0 ? limit : void 0).map((id) => ({ kind: "user", id }));
    },
    listGroups: async ({ cfg, query, limit }) => {
      const q = query?.trim().toLowerCase() || "";
      const channelConfig = cfg.channels?.dingtalk;
      const ids = /* @__PURE__ */ new Set();
      for (const groupId of Object.keys(channelConfig?.groups ?? {})) {
        const trimmed = groupId.trim();
        if (trimmed && trimmed !== "*") ids.add(trimmed);
      }
      return Array.from(ids).filter((id) => q ? id.toLowerCase().includes(q) : true).slice(0, limit && limit > 0 ? limit : void 0).map((id) => ({ kind: "group", id }));
    }
  },
  outbound: {
    deliveryMode: "direct",
    chunker: (text, limit) => getDingtalkRuntime().channel.text.chunkMarkdownText(text, limit),
    chunkerMode: "markdown",
    textChunkLimit: 2048,
    sendText: async ({ to, text, cfg }) => {
      const cachedWebhook = getCachedSessionWebhook(to);
      if (cachedWebhook) {
        await sendDingtalkMessageViaWebhook(cachedWebhook, {
          msgtype: "text",
          text: { content: text }
        });
        return { channel: DINGTALK_CHANNEL_ID, messageId: "" };
      }
      const channelConfig = cfg.channels?.dingtalk;
      const result = await sendDingtalkMessage(channelConfig, [to], text, {
        msgType: "text"
      });
      return { channel: DINGTALK_CHANNEL_ID, messageId: "", ...result };
    },
    sendMedia: async ({ to, text, cfg }) => {
      const cachedWebhook = getCachedSessionWebhook(to);
      if (cachedWebhook) {
        await sendDingtalkMessageViaWebhook(cachedWebhook, {
          msgtype: "text",
          text: { content: text }
        });
        return { channel: DINGTALK_CHANNEL_ID, messageId: "" };
      }
      const channelConfig = cfg.channels?.dingtalk;
      const result = await sendDingtalkMessage(channelConfig, [to], text);
      return { channel: DINGTALK_CHANNEL_ID, messageId: "", ...result };
    }
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null
    }),
    probeAccount: async ({ cfg }) => {
      const channelConfig = cfg.channels?.dingtalk;
      return await probeDingtalkConnection(channelConfig);
    },
    buildAccountSnapshot: ({ account, runtime, probe }) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      probe
    })
  },
  gateway: {
    startAccount: async (ctx) => {
      const runtime = getDingtalkRuntime();
      const channelConfig = ctx.cfg.channels?.dingtalk;
      const mode = getConnectionMode(channelConfig);
      const recentDingtalkMsgIds = /* @__PURE__ */ new Set();
      ctx.log?.info(`[dingtalk] \u542F\u52A8\u9489\u9489\u6E20\u9053 (\u8D26\u6237: ${ctx.accountId}, \u6A21\u5F0F: ${mode})`);
      if (mode === "stream") {
        ctx.log?.info(`[dingtalk] \u4F7F\u7528 Stream \u6A21\u5F0F (\u65E0\u9700\u516C\u7F51 IP)`);
        const streamClient = await createStreamClient({
          config: channelConfig ?? {},
          accountId: ctx.accountId,
          gatewayPort: runtime.gateway?.port || Number(process.env.OPENCLAWCN_GATEWAY_PORT) || 18789,
          cfg: ctx.cfg,
          log: ctx.log,
          onStart: () => {
            ctx.setStatus({ accountId: ctx.accountId, running: true, lastStartAt: Date.now() });
          },
          onStop: () => {
            ctx.setStatus({ accountId: ctx.accountId, running: false, lastStopAt: Date.now() });
          }
        });
        ctx.setStatus({ accountId: ctx.accountId, running: true, lastStartAt: Date.now() });
        return new Promise((resolve) => {
          ctx.abortSignal.addEventListener("abort", () => {
            streamClient.stop();
            ctx.log?.info(`[dingtalk] \u9489\u9489\u6E20\u9053\u5DF2\u505C\u6B62 (\u8D26\u6237: ${ctx.accountId}, \u6A21\u5F0F: stream)`);
            ctx.setStatus({ accountId: ctx.accountId, running: false, lastStopAt: Date.now() });
            resolve();
          });
        });
      }
      const webhookPath = channelConfig?.webhookPath ?? DEFAULT_WEBHOOK_PATH;
      ctx.log?.info(`[dingtalk] \u4F7F\u7528 Webhook \u6A21\u5F0F\uFF0C\u8DEF\u5F84: ${webhookPath}`);
      const handler = createDingtalkWebhookHandler({
        config: channelConfig ?? {},
        log: ctx.log,
        onMessage: async (msg) => {
          if (recentDingtalkMsgIds.has(msg.msgId)) {
            ctx.log?.info(`[dingtalk] \u8DF3\u8FC7\u91CD\u590D\u6D88\u606F: msgId=${msg.msgId}`);
            return;
          }
          recentDingtalkMsgIds.add(msg.msgId);
          setTimeout(() => recentDingtalkMsgIds.delete(msg.msgId), 5 * 60e3);
          ctx.log?.info(`[dingtalk] \u6536\u5230\u6D88\u606F: type=${msg.conversationType === "1" ? "\u5355\u804A" : "\u7FA4\u804A"}, from=${msg.senderNick}`);
          if (msg.sessionWebhook && msg.sessionWebhookExpiredTime) {
            cacheSessionWebhook(
              msg.conversationId,
              msg.sessionWebhook,
              msg.sessionWebhookExpiredTime
            );
          }
          const inboundCtx = {
            Channel: DINGTALK_CHANNEL_ID,
            AccountId: ctx.accountId,
            MessageSid: msg.msgId,
            Provider: DINGTALK_CHANNEL_ID,
            From: msg.conversationId,
            // 用于路由和回复
            SenderId: msg.senderId,
            SenderName: msg.senderNick,
            Body: msg.text,
            // MsgContext 使用 Body，不是 Text
            RawBody: msg.text,
            ChatType: msg.conversationType === "1" ? "direct" : "group",
            Timestamp: Date.now()
          };
          try {
            await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
              ctx: inboundCtx,
              cfg: ctx.cfg,
              dispatcherOptions: {
                deliver: async (payload) => {
                  const text = payload.text ?? "";
                  if (!text) return;
                  const cachedWebhook = getCachedSessionWebhook(msg.conversationId);
                  if (cachedWebhook) {
                    try {
                      await sendDingtalkMessageViaWebhook(cachedWebhook, {
                        msgtype: "text",
                        text: { content: text }
                      });
                      ctx.log?.info(`[dingtalk] \u5DF2\u56DE\u590D\u6D88\u606F\u5230 ${msg.conversationId}`);
                      return;
                    } catch (webhookErr) {
                      ctx.log?.warn?.(`[dingtalk] Session Webhook \u53D1\u9001\u5931\u8D25\uFF0C\u964D\u7EA7\u5230\u6279\u91CF API: ${webhookErr}`);
                    }
                  }
                  if (channelConfig) {
                    try {
                      await sendDingtalkMessage(channelConfig, [msg.senderId], text);
                      ctx.log?.info(`[dingtalk] \u5DF2\u901A\u8FC7\u6279\u91CF API \u56DE\u590D\u5230 ${msg.senderId} (\u79C1\u804A\u964D\u7EA7)`);
                    } catch (apiErr) {
                      ctx.log?.error?.(`[dingtalk] \u6279\u91CF API \u4E5F\u5931\u8D25: ${apiErr}`);
                    }
                  } else {
                    ctx.log?.error?.(`[dingtalk] \u65E0\u6CD5\u56DE\u590D: \u65E0\u53EF\u7528\u53D1\u9001\u901A\u9053 (conversation=${msg.conversationId})`);
                  }
                },
                onError: (err) => {
                  ctx.log?.error(`[dingtalk] \u56DE\u590D\u9519\u8BEF: ${err}`);
                }
              },
              replyOptions: {}
            });
          } catch (err) {
            ctx.log?.error(`[dingtalk] \u5904\u7406\u6D88\u606F\u5931\u8D25: ${err}`);
          }
        }
      });
      const unregister = registerPluginHttpRoute({
        path: webhookPath,
        handler,
        pluginId: DINGTALK_CHANNEL_ID,
        accountId: ctx.accountId,
        log: (message) => ctx.log?.info(message)
      });
      ctx.log?.info(`[dingtalk] HTTP \u8DEF\u7531\u5DF2\u6CE8\u518C: ${webhookPath}`);
      ctx.setStatus({ accountId: ctx.accountId, running: true, lastStartAt: Date.now() });
      return new Promise((resolve) => {
        ctx.abortSignal.addEventListener("abort", () => {
          unregister();
          ctx.log?.info(`[dingtalk] \u9489\u9489\u6E20\u9053\u5DF2\u505C\u6B62 (\u8D26\u6237: ${ctx.accountId}, \u6A21\u5F0F: webhook)`);
          ctx.setStatus({ accountId: ctx.accountId, running: false, lastStopAt: Date.now() });
          resolve();
        });
      });
    }
  }
};
export {
  dingtalkPlugin
};
