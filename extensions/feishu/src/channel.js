import {
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  PAIRING_APPROVED_MESSAGE,
  registerPluginHttpRoute
} from "openclawcn/plugin-sdk";
import { getFeishuRuntime } from "./runtime.js";
import { sendFeishuMessage, probeFeishuConnection, sendMarkdownCardFeishu } from "./api.js";
import { createFeishuWebhookHandler } from "./webhook.js";
import { monitorFeishuProvider, getCurrentBotOpenId } from "./monitor.js";
import { sendMediaFeishu } from "./media.js";
import { resolveFeishuCredentials } from "./client.js";
import { normalizeFeishuTarget, looksLikeFeishuId } from "./targets.js";
import { FeishuConfigSchema } from "./config-schema.js";
const FEISHU_CHANNEL_ID = "feishu";
const DEFAULT_WEBHOOK_PATH = "/feishu/webhook";
const meta = {
  id: FEISHU_CHANNEL_ID,
  label: "\u98DE\u4E66",
  selectionLabel: "\u98DE\u4E66 (Feishu/Lark)",
  docsPath: "/channels/feishu",
  docsLabel: "feishu",
  blurb: "\u98DE\u4E66\u4F01\u4E1A\u5185\u90E8\u5E94\u7528\u673A\u5668\u4EBA",
  aliases: ["lark", "feishu"],
  order: -4
  // 国内渠道优先：飞书 > 钉钉 > 企业微信 > QQ > 其他...
};
function resolveFeishuAccountInternal(params) {
  const { cfg, accountId } = params;
  const resolvedAccountId = accountId ?? DEFAULT_ACCOUNT_ID;
  const channelConfig = cfg.channels?.feishu;
  const creds = resolveFeishuCredentials(channelConfig);
  return {
    accountId: resolvedAccountId,
    enabled: channelConfig?.enabled !== false,
    configured: Boolean(creds),
    appId: creds?.appId ?? null,
    appSecret: creds?.appSecret ?? null,
    config: channelConfig ?? {},
    domain: creds?.domain ?? "feishu"
  };
}
function shouldUseCard(text, renderMode) {
  if (renderMode === "card") return true;
  if (renderMode === "raw") return false;
  if (/```[\s\S]*?```/.test(text)) return true;
  if (/\|.+\|[\r\n]+\|[-:| ]+\|/.test(text)) return true;
  return false;
}
const feishuPlugin = {
  id: FEISHU_CHANNEL_ID,
  meta: {
    ...meta,
    aliases: [...meta.aliases]
  },
  pairing: {
    idLabel: "feishuUserId",
    normalizeAllowEntry: (entry) => entry.replace(/^(feishu|lark|user|open_id):/i, ""),
    notifyApproval: async ({ cfg, id }) => {
      const channelConfig = cfg.channels?.feishu;
      await sendFeishuMessage(channelConfig, id, PAIRING_APPROVED_MESSAGE);
    }
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
    threads: true,
    reactions: true,
    edit: true,
    reply: true
  },
  agentPrompt: {
    messageToolHints: () => [
      "- \u98DE\u4E66\u76EE\u6807: \u7701\u7565 `target` \u81EA\u52A8\u56DE\u590D\u5F53\u524D\u4F1A\u8BDD\u3002\u663E\u5F0F\u76EE\u6807: `user:open_id` \u6216 `chat:chat_id`\u3002",
      "- \u98DE\u4E66\u652F\u6301\u5361\u7247\u6D88\u606F\u7528\u4E8E\u5BCC\u6587\u672C\u6E32\u67D3\u3002"
    ]
  },
  reload: { configPrefixes: ["channels.feishu"] },
  configSchema: buildChannelConfigSchema(FeishuConfigSchema),
  config: {
    listAccountIds: () => [DEFAULT_ACCOUNT_ID],
    resolveAccount: (cfg, accountId) => resolveFeishuAccountInternal({ cfg, accountId }),
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    setAccountEnabled: ({ cfg, enabled }) => ({
      ...cfg,
      channels: {
        ...cfg.channels,
        feishu: {
          ...cfg.channels?.feishu,
          enabled
        }
      }
    }),
    deleteAccount: ({ cfg }) => {
      const next = { ...cfg };
      const nextChannels = { ...cfg.channels };
      delete nextChannels.feishu;
      if (Object.keys(nextChannels).length > 0) {
        next.channels = nextChannels;
      } else {
        delete next.channels;
      }
      return next;
    },
    isConfigured: (_account, cfg) => {
      const creds = resolveFeishuCredentials(cfg.channels?.feishu);
      return Boolean(creds);
    },
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      domain: account.domain
    }),
    resolveAllowFrom: ({ cfg }) => (cfg.channels?.feishu?.allowFrom ?? []).map(String),
    formatAllowFrom: ({ allowFrom }) => allowFrom.map((entry) => String(entry).trim()).filter(Boolean).map((entry) => entry.toLowerCase())
  },
  security: {
    collectWarnings: ({ cfg }) => {
      const channelConfig = cfg.channels?.feishu;
      const defaultGroupPolicy = cfg.channels?.defaults?.groupPolicy;
      const groupPolicy = channelConfig?.groupPolicy ?? defaultGroupPolicy ?? "allowlist";
      if (groupPolicy !== "open") return [];
      return [
        `- \u98DE\u4E66\u7FA4\u804A: groupPolicy="open" \u5141\u8BB8\u4EFB\u4F55\u7FA4\u6210\u5458\u89E6\u53D1 (\u9700\u8981 @\u673A\u5668\u4EBA)\u3002\u8BBE\u7F6E channels.feishu.groupPolicy="allowlist" + channels.feishu.groups \u6765\u9650\u5236\u3002`
      ];
    }
  },
  messaging: {
    normalizeTarget: (raw) => normalizeFeishuTarget(raw) ?? void 0,
    targetResolver: {
      looksLikeId: looksLikeFeishuId,
      hint: "<chatId|openId|unionId>"
    }
  },
  directory: {
    self: async () => null,
    listPeers: async ({ cfg, query, limit }) => {
      const q = query?.trim().toLowerCase() || "";
      const channelConfig = cfg.channels?.feishu;
      const ids = /* @__PURE__ */ new Set();
      for (const entry of channelConfig?.allowFrom ?? []) {
        const trimmed = String(entry).trim();
        if (trimmed && trimmed !== "*") ids.add(trimmed);
      }
      return Array.from(ids).filter((id) => q ? id.toLowerCase().includes(q) : true).slice(0, limit && limit > 0 ? limit : void 0).map((id) => ({ kind: "user", id }));
    },
    listGroups: async ({ cfg, query, limit }) => {
      const q = query?.trim().toLowerCase() || "";
      const channelConfig = cfg.channels?.feishu;
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
    chunker: (text, limit) => getFeishuRuntime().channel.text.chunkMarkdownText(text, limit),
    chunkerMode: "markdown",
    textChunkLimit: 4e3,
    sendText: async ({ to, text, cfg, replyToId }) => {
      const channelConfig = cfg.channels?.feishu;
      const renderMode = channelConfig?.renderMode ?? "auto";
      if (shouldUseCard(text, renderMode)) {
        const result2 = await sendMarkdownCardFeishu({
          config: channelConfig,
          to,
          text,
          replyToMessageId: replyToId ?? void 0
        });
        return { channel: FEISHU_CHANNEL_ID, ...result2 };
      }
      const result = await sendFeishuMessage(channelConfig, to, text, {
        msgType: "text",
        replyToId: replyToId ?? void 0
      });
      return { channel: FEISHU_CHANNEL_ID, ...result };
    },
    sendMedia: async ({ to, text, cfg, replyToId, mediaUrl }) => {
      const channelConfig = cfg.channels?.feishu;
      if (text?.trim()) {
        await sendFeishuMessage(channelConfig, to, text, {
          replyToId: replyToId ?? void 0
        });
      }
      if (mediaUrl) {
        try {
          const result2 = await sendMediaFeishu({
            cfg: channelConfig,
            to,
            mediaUrl,
            replyToMessageId: replyToId ?? void 0
          });
          return { channel: FEISHU_CHANNEL_ID, ...result2 };
        } catch (err) {
          console.error(`[feishu] \u5A92\u4F53\u4E0A\u4F20\u5931\u8D25:`, err);
          const fallbackText = `\u{1F4CE} ${mediaUrl}`;
          const result2 = await sendFeishuMessage(channelConfig, to, fallbackText);
          return { channel: FEISHU_CHANNEL_ID, ...result2 };
        }
      }
      const result = await sendFeishuMessage(channelConfig, to, text ?? "");
      return { channel: FEISHU_CHANNEL_ID, ...result };
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
      const channelConfig = cfg.channels?.feishu;
      return await probeFeishuConnection(channelConfig);
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
      const runtime = getFeishuRuntime();
      const channelConfig = ctx.cfg.channels?.feishu;
      const connectionMode = channelConfig?.connectionMode ?? "websocket";
      const webhookPath = channelConfig?.webhookPath ?? DEFAULT_WEBHOOK_PATH;
      const port = channelConfig?.webhookPort ?? null;
      ctx.log?.info(`[feishu] \u542F\u52A8\u98DE\u4E66\u6E20\u9053 (\u8D26\u6237: ${ctx.accountId}, \u6A21\u5F0F: ${connectionMode})`);
      ctx.setStatus({ accountId: ctx.accountId, running: true, lastStartAt: Date.now(), port });
      const recentMessageIds = /* @__PURE__ */ new Set();
      const DEDUPE_TTL_MS = 5 * 60e3;
      const handleMessage = async (msg) => {
        if (recentMessageIds.has(msg.messageId)) {
          ctx.log?.info(`[feishu] \u8DF3\u8FC7\u91CD\u590D\u6D88\u606F: messageId=${msg.messageId}`);
          return;
        }
        recentMessageIds.add(msg.messageId);
        setTimeout(() => recentMessageIds.delete(msg.messageId), DEDUPE_TTL_MS);
        ctx.log?.info(`[feishu] \u6536\u5230\u6D88\u606F: chatType=${msg.chatType}, from=${msg.senderId}`);
        const inboundCtx = {
          Channel: FEISHU_CHANNEL_ID,
          AccountId: ctx.accountId,
          MessageSid: msg.messageId,
          Provider: FEISHU_CHANNEL_ID,
          From: msg.chatId,
          SenderId: msg.senderId,
          SenderName: msg.senderName ?? msg.senderId,
          Body: msg.text,
          RawBody: msg.text,
          ChatType: msg.chatType === "p2p" ? "direct" : "group",
          Timestamp: Date.now()
        };
        try {
          await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
            ctx: inboundCtx,
            cfg: ctx.cfg,
            dispatcherOptions: {
              deliver: async (payload) => {
                const text = payload.text ?? "";
                if (text) {
                  const to = msg.chatType === "p2p" ? msg.senderOpenId ?? msg.senderId : msg.chatId;
                  const renderMode = channelConfig?.renderMode ?? "auto";
                  if (shouldUseCard(text, renderMode)) {
                    await sendMarkdownCardFeishu({
                      config: channelConfig ?? {},
                      to,
                      text
                    });
                  } else {
                    await sendFeishuMessage(channelConfig ?? {}, to, text);
                  }
                  ctx.log?.info(`[feishu] \u5DF2\u56DE\u590D\u6D88\u606F\u5230 ${msg.chatType === "p2p" ? "\u7528\u6237 " + to : "\u4F1A\u8BDD " + msg.chatId}`);
                }
              },
              onError: (err) => {
                ctx.log?.error(`[feishu] \u56DE\u590D\u9519\u8BEF: ${err}`);
              }
            },
            replyOptions: {}
          });
        } catch (err) {
          ctx.log?.error(`[feishu] \u5904\u7406\u6D88\u606F\u5931\u8D25: ${err}`);
        }
      };
      if (connectionMode === "websocket") {
        ctx.log?.info(`[feishu] \u4F7F\u7528 WebSocket \u957F\u8FDE\u63A5\u6A21\u5F0F`);
        return monitorFeishuProvider({
          config: ctx.cfg,
          log: (msg) => ctx.log?.info(msg),
          error: (msg) => ctx.log?.error(msg),
          abortSignal: ctx.abortSignal,
          accountId: ctx.accountId,
          onMessage: async (event) => {
            let text = "";
            try {
              const content = JSON.parse(event.message.content);
              if (event.message.message_type === "text") {
                text = content.text ?? "";
              }
            } catch {
              text = event.message.content;
            }
            const botOpenId = getCurrentBotOpenId();
            if (event.message.mentions) {
              for (const m of event.message.mentions) {
                if (botOpenId && m.id.open_id === botOpenId) {
                  text = text.replace(m.key, "").trim();
                }
              }
            }
            await handleMessage({
              messageId: event.message.message_id,
              chatId: event.message.chat_id,
              chatType: event.message.chat_type,
              senderId: event.sender.sender_id.user_id ?? event.sender.sender_id.open_id ?? "unknown",
              senderOpenId: event.sender.sender_id.open_id,
              text
            });
          }
        });
      }
      ctx.log?.info(`[feishu] \u4F7F\u7528 Webhook \u6A21\u5F0F, \u8DEF\u5F84: ${webhookPath}`);
      const handler = createFeishuWebhookHandler({
        config: channelConfig ?? {},
        log: ctx.log,
        onMessage: async (msg) => {
          await handleMessage(msg);
        }
      });
      const unregister = registerPluginHttpRoute({
        path: webhookPath,
        handler,
        pluginId: FEISHU_CHANNEL_ID,
        accountId: ctx.accountId,
        log: (message) => ctx.log?.info(message)
      });
      ctx.log?.info(`[feishu] HTTP \u8DEF\u7531\u5DF2\u6CE8\u518C: ${webhookPath}`);
      return new Promise((resolve) => {
        ctx.abortSignal.addEventListener("abort", () => {
          unregister();
          ctx.log?.info(`[feishu] \u98DE\u4E66\u6E20\u9053\u5DF2\u505C\u6B62 (\u8D26\u6237: ${ctx.accountId})`);
          ctx.setStatus({ accountId: ctx.accountId, running: false, lastStopAt: Date.now() });
          resolve();
        });
      });
    }
  }
};
export {
  feishuPlugin
};
