import {
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  PAIRING_APPROVED_MESSAGE,
  registerPluginHttpRoute
} from "openclawcn/plugin-sdk";
import { getWecomRuntime } from "./runtime.js";
import { sendWecomMessage, probeWecomConnection } from "./api.js";
import { createWecomWebhookHandler } from "./webhook.js";
import { WecomConfigSchema } from "./config-schema.js";
const WECOM_CHANNEL_ID = "wecom";
const DEFAULT_WEBHOOK_PATH = "/wecom/webhook";
const meta = {
  id: WECOM_CHANNEL_ID,
  label: "\u4F01\u4E1A\u5FAE\u4FE1",
  selectionLabel: "\u4F01\u4E1A\u5FAE\u4FE1 (WeCom)",
  docsPath: "/channels/wecom",
  docsLabel: "wecom",
  blurb: "\u4F01\u4E1A\u5FAE\u4FE1\u81EA\u5EFA\u5E94\u7528\u6D88\u606F",
  aliases: ["wecom", "wechat-work", "wxwork"],
  order: -2
  // 国内渠道优先：飞书 > 钉钉 > 企业微信 > QQ > 其他...
};
function checkBotMentioned(text, _config) {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.startsWith("@")) {
    return true;
  }
  if (trimmed.includes("@")) {
    return true;
  }
  return false;
}
function listWecomAccountIds(cfg) {
  const channelConfig = cfg.channels?.wecom;
  const accounts = channelConfig?.accounts;
  if (accounts && typeof accounts === "object") {
    const ids = Object.keys(accounts).filter(Boolean);
    if (ids.length > 0) {
      return ids.sort((a, b) => a.localeCompare(b));
    }
  }
  return [DEFAULT_ACCOUNT_ID];
}
function getDefaultWecomAccountId(cfg) {
  const channelConfig = cfg.channels?.wecom;
  if (channelConfig?.defaultAccount?.trim()) {
    return channelConfig.defaultAccount.trim();
  }
  const ids = listWecomAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}
function mergeAccountConfig(baseConfig, accountConfig) {
  const { accounts: _accounts, defaultAccount: _defaultAccount, ...baseFields } = baseConfig;
  return {
    ...baseFields,
    ...accountConfig ?? {},
    // 如果账户有自己的 app 配置，使用账户的；否则使用基础的
    app: accountConfig?.app ?? baseConfig.app,
    // 群聊配置合并
    groups: {
      ...baseConfig.groups ?? {},
      ...accountConfig?.groups ?? {}
    }
  };
}
function resolveWecomAccount(params) {
  const { cfg, accountId } = params;
  const resolvedAccountId = accountId ?? DEFAULT_ACCOUNT_ID;
  const channelConfig = cfg.channels?.wecom;
  const hasAccounts = channelConfig?.accounts && Object.keys(channelConfig.accounts).length > 0;
  const accountSpecificConfig = hasAccounts ? channelConfig?.accounts?.[resolvedAccountId] : void 0;
  const mergedConfig = accountSpecificConfig ? mergeAccountConfig(channelConfig ?? {}, accountSpecificConfig) : channelConfig ?? {};
  const corpId = mergedConfig.app?.corpId ?? null;
  const agentId = mergedConfig.app?.agentId ?? null;
  const agentSecret = mergedConfig.app?.agentSecret ?? null;
  const baseEnabled = channelConfig?.enabled !== false;
  const accountEnabled = accountSpecificConfig?.enabled !== false;
  return {
    accountId: resolvedAccountId,
    enabled: baseEnabled && accountEnabled,
    configured: Boolean(corpId && agentId && agentSecret),
    corpId,
    agentId,
    agentSecret,
    config: mergedConfig
  };
}
function resolveWecomCredentials(config, accountId) {
  if (accountId && config?.accounts?.[accountId]?.app) {
    const accountApp = config.accounts[accountId].app;
    return {
      corpId: accountApp?.corpId ?? null,
      agentId: accountApp?.agentId ?? null,
      agentSecret: accountApp?.agentSecret ?? null
    };
  }
  return {
    corpId: config?.app?.corpId ?? null,
    agentId: config?.app?.agentId ?? null,
    agentSecret: config?.app?.agentSecret ?? null
  };
}
const wecomPlugin = {
  id: WECOM_CHANNEL_ID,
  meta: {
    ...meta,
    aliases: [...meta.aliases]
  },
  pairing: {
    idLabel: "wecomUserId",
    normalizeAllowEntry: (entry) => entry.replace(/^(wecom|wxwork):/i, ""),
    notifyApproval: async ({ cfg, id }) => {
      const channelConfig = cfg.channels?.wecom;
      await sendWecomMessage(channelConfig, id, PAIRING_APPROVED_MESSAGE);
    }
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    media: false
    // 企业微信应用消息暂不支持富媒体
  },
  reload: { configPrefixes: ["channels.wecom"] },
  configSchema: buildChannelConfigSchema(WecomConfigSchema),
  config: {
    listAccountIds: (cfg) => listWecomAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveWecomAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => getDefaultWecomAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }) => {
      const channelConfig = cfg.channels?.wecom;
      const resolvedAccountId = accountId ?? DEFAULT_ACCOUNT_ID;
      const hasAccounts = channelConfig?.accounts && Object.keys(channelConfig.accounts).length > 0;
      const isSpecificAccount = hasAccounts && resolvedAccountId !== DEFAULT_ACCOUNT_ID;
      if (isSpecificAccount && channelConfig?.accounts?.[resolvedAccountId]) {
        return {
          ...cfg,
          channels: {
            ...cfg.channels,
            wecom: {
              ...channelConfig,
              accounts: {
                ...channelConfig.accounts,
                [resolvedAccountId]: {
                  ...channelConfig.accounts[resolvedAccountId],
                  enabled
                }
              }
            }
          }
        };
      }
      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          wecom: {
            ...channelConfig ?? {},
            enabled
          }
        }
      };
    },
    deleteAccount: ({ cfg, accountId }) => {
      const channelConfig = cfg.channels?.wecom;
      const resolvedAccountId = accountId ?? DEFAULT_ACCOUNT_ID;
      if (resolvedAccountId !== DEFAULT_ACCOUNT_ID && channelConfig?.accounts?.[resolvedAccountId]) {
        const { [resolvedAccountId]: _deleted, ...remainingAccounts } = channelConfig.accounts;
        return {
          ...cfg,
          channels: {
            ...cfg.channels,
            wecom: {
              ...channelConfig,
              accounts: Object.keys(remainingAccounts).length > 0 ? remainingAccounts : void 0
            }
          }
        };
      }
      const next = { ...cfg };
      const nextChannels = { ...cfg.channels };
      delete nextChannels.wecom;
      if (Object.keys(nextChannels).length > 0) {
        next.channels = nextChannels;
      } else {
        delete next.channels;
      }
      return next;
    },
    isConfigured: (account, cfg) => {
      const channelConfig = cfg.channels?.wecom;
      const { corpId, agentId, agentSecret } = resolveWecomCredentials(channelConfig, account.accountId);
      return Boolean(corpId && agentId && agentSecret);
    },
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      name: account.config?.name,
      webhookPath: account.config?.webhookPath
    }),
    resolveAllowFrom: ({ cfg, accountId }) => {
      const account = resolveWecomAccount({ cfg, accountId });
      return account.config?.allowFrom ?? [];
    },
    formatAllowFrom: ({ allowFrom }) => allowFrom.map((entry) => String(entry).trim()).filter(Boolean).map((entry) => entry.toLowerCase())
  },
  groups: {
    resolveRequireMention: ({ cfg }) => {
      const channelConfig = cfg.channels?.wecom;
      return channelConfig?.requireMention !== false;
    }
  },
  security: {
    collectWarnings: ({ cfg }) => {
      const channelConfig = cfg.channels?.wecom;
      const dmPolicy = channelConfig?.dmPolicy ?? "allowlist";
      const groupPolicy = channelConfig?.groupPolicy ?? "allowlist";
      const warnings = [];
      if (dmPolicy === "open") {
        warnings.push(
          `- \u4F01\u4E1A\u5FAE\u4FE1: dmPolicy="open" \u5141\u8BB8\u4EFB\u4F55\u4F01\u4E1A\u6210\u5458\u53D1\u9001\u6D88\u606F\u3002\u5EFA\u8BAE\u8BBE\u7F6E channels.wecom.dmPolicy="allowlist" + channels.wecom.allowFrom \u6765\u9650\u5236\u3002`
        );
      }
      if (groupPolicy === "open") {
        warnings.push(
          `- \u4F01\u4E1A\u5FAE\u4FE1\u7FA4\u804A: groupPolicy="open" \u5141\u8BB8\u4EFB\u4F55\u7FA4\u6210\u5458\u89E6\u53D1 (@\u673A\u5668\u4EBA\u624D\u54CD\u5E94)\u3002\u5EFA\u8BAE\u8BBE\u7F6E channels.wecom.groupPolicy="allowlist" + channels.wecom.groupAllowFrom \u6765\u9650\u5236\u3002`
        );
      }
      return warnings;
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
        return trimmed.length > 0 && /^[a-zA-Z0-9_-]+$/.test(trimmed);
      },
      hint: "<userId>"
    }
  },
  directory: {
    self: async () => null,
    listPeers: async ({ cfg, query, limit }) => {
      const q = query?.trim().toLowerCase() || "";
      const channelConfig = cfg.channels?.wecom;
      const ids = /* @__PURE__ */ new Set();
      for (const entry of channelConfig?.allowFrom ?? []) {
        const trimmed = String(entry).trim();
        if (trimmed && trimmed !== "*") ids.add(trimmed);
      }
      return Array.from(ids).filter((id) => q ? id.toLowerCase().includes(q) : true).slice(0, limit && limit > 0 ? limit : void 0).map((id) => ({ kind: "user", id }));
    },
    listGroups: async ({ cfg, query, limit }) => {
      const channelConfig = cfg.channels?.wecom;
      const q = query?.trim().toLowerCase() || "";
      const ids = /* @__PURE__ */ new Set();
      for (const entry of channelConfig?.groupAllowFrom ?? []) {
        const trimmed = String(entry).trim();
        if (trimmed && trimmed !== "*") ids.add(trimmed);
      }
      for (const groupId of Object.keys(channelConfig?.groups ?? {})) {
        const trimmed = groupId.trim();
        if (trimmed) ids.add(trimmed);
      }
      return Array.from(ids).filter((id) => q ? id.toLowerCase().includes(q) : true).slice(0, limit && limit > 0 ? limit : void 0).map((id) => ({ kind: "group", id }));
    }
  },
  outbound: {
    deliveryMode: "direct",
    chunker: (text, limit) => getWecomRuntime().channel.text.chunkMarkdownText(text, limit),
    chunkerMode: "markdown",
    textChunkLimit: 2048,
    // 企业微信文本消息限制
    sendText: async ({ to, text, cfg }) => {
      const channelConfig = cfg.channels?.wecom;
      const result = await sendWecomMessage(channelConfig, to, text, {
        msgType: "text"
      });
      return { channel: WECOM_CHANNEL_ID, messageId: result.msgid ?? "", ...result };
    },
    sendMedia: async ({ to, text, cfg }) => {
      const channelConfig = cfg.channels?.wecom;
      const result = await sendWecomMessage(channelConfig, to, text);
      return { channel: WECOM_CHANNEL_ID, messageId: result.msgid ?? "", ...result };
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
      const channelConfig = cfg.channels?.wecom;
      return await probeWecomConnection(channelConfig);
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
      const runtime = getWecomRuntime();
      const channelConfig = ctx.cfg.channels?.wecom;
      const webhookPath = channelConfig?.webhookPath ?? DEFAULT_WEBHOOK_PATH;
      ctx.log?.info(`[wecom] \u542F\u52A8\u4F01\u4E1A\u5FAE\u4FE1\u6E20\u9053 (\u8D26\u6237: ${ctx.accountId})`);
      ctx.log?.info(`[wecom] Webhook \u8DEF\u5F84: ${webhookPath}`);
      const handler = createWecomWebhookHandler({
        config: channelConfig ?? {},
        log: ctx.log,
        onMessage: async (msg) => {
          ctx.log?.info(`[wecom] \u6536\u5230\u6D88\u606F: from=${msg.userId}, type=${msg.msgType}, chatType=${msg.chatType}, chatId=${msg.chatId ?? "N/A"}`);
          if (msg.chatType === "group") {
            const groupPolicy = channelConfig?.groupPolicy ?? "allowlist";
            const groupAllowFrom = channelConfig?.groupAllowFrom ?? [];
            const requireMention = channelConfig?.requireMention !== false;
            if (groupPolicy === "disabled") {
              ctx.log?.info(`[wecom] \u7FA4\u804A\u7B56\u7565\u4E3A disabled\uFF0C\u8DF3\u8FC7\u6D88\u606F\u5904\u7406`);
              return;
            }
            if (groupPolicy === "allowlist" && msg.chatId) {
              const isAllowed = groupAllowFrom.includes("*") || groupAllowFrom.includes(msg.chatId);
              if (!isAllowed) {
                ctx.log?.info(`[wecom] \u7FA4 ${msg.chatId} \u4E0D\u5728\u767D\u540D\u5355\u4E2D\uFF0C\u8DF3\u8FC7\u6D88\u606F\u5904\u7406`);
                return;
              }
            }
            if (requireMention) {
              const botMentioned = checkBotMentioned(msg.text, channelConfig);
              if (!botMentioned) {
                ctx.log?.info(`[wecom] \u7FA4\u804A\u6D88\u606F\u672A @\u673A\u5668\u4EBA (requireMention=true)\uFF0C\u8DF3\u8FC7`);
                return;
              }
            }
            const groupConfig = msg.chatId ? channelConfig?.groups?.[msg.chatId] : void 0;
            if (groupConfig) {
              if (groupConfig.allowFrom && groupConfig.allowFrom.length > 0) {
                const isUserAllowed = groupConfig.allowFrom.includes("*") || groupConfig.allowFrom.includes(msg.userId);
                if (!isUserAllowed) {
                  ctx.log?.info(`[wecom] \u7528\u6237 ${msg.userId} \u4E0D\u5728\u7FA4 ${msg.chatId} \u7684 allowFrom \u4E2D\uFF0C\u8DF3\u8FC7`);
                  return;
                }
              }
            }
          }
          const chatTypeLabel = msg.chatType === "group" ? "group" : "direct";
          const fromLabel = msg.chatType === "group" ? `wecom:group:${msg.chatId}:${msg.userId}` : `wecom:${msg.userId}`;
          const toLabel = msg.chatType === "group" ? `wecom:group:${msg.chatId}` : `wecom:${msg.userId}`;
          const inboundCtx = {
            Channel: WECOM_CHANNEL_ID,
            AccountId: ctx.accountId,
            MessageId: msg.msgId,
            From: fromLabel,
            SenderId: msg.userId,
            SenderName: msg.userId,
            // 企业微信回调不包含用户名，用 userId 代替
            Body: msg.text,
            RawBody: msg.text,
            ChatType: chatTypeLabel,
            ChatId: msg.chatId,
            To: toLabel,
            Timestamp: msg.createTime * 1e3
          };
          try {
            await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
              ctx: inboundCtx,
              cfg: ctx.cfg,
              dispatcherOptions: {
                deliver: async (payload) => {
                  const text = payload.text ?? "";
                  if (text && channelConfig) {
                    const target = msg.chatType === "group" && msg.chatId ? msg.chatId : msg.userId;
                    await sendWecomMessage(channelConfig, target, text);
                    ctx.log?.info(`[wecom] \u5DF2\u56DE\u590D\u6D88\u606F\u5230 ${target}`);
                  }
                },
                onError: (err) => {
                  ctx.log?.error(`[wecom] \u56DE\u590D\u9519\u8BEF: ${err}`);
                }
              },
              replyOptions: {}
            });
          } catch (err) {
            ctx.log?.error(`[wecom] \u5904\u7406\u6D88\u606F\u5931\u8D25: ${err}`);
          }
        }
      });
      const unregister = registerPluginHttpRoute({
        path: webhookPath,
        handler,
        pluginId: WECOM_CHANNEL_ID,
        accountId: ctx.accountId,
        log: (message) => ctx.log?.info(message)
      });
      ctx.log?.info(`[wecom] HTTP \u8DEF\u7531\u5DF2\u6CE8\u518C: ${webhookPath}`);
      ctx.setStatus({ accountId: ctx.accountId, running: true, lastStartAt: Date.now() });
      return new Promise((resolve) => {
        ctx.abortSignal.addEventListener("abort", () => {
          unregister();
          ctx.log?.info(`[wecom] \u4F01\u4E1A\u5FAE\u4FE1\u6E20\u9053\u5DF2\u505C\u6B62 (\u8D26\u6237: ${ctx.accountId})`);
          ctx.setStatus({ accountId: ctx.accountId, running: false, lastStopAt: Date.now() });
          resolve();
        });
      });
    }
  }
};
export {
  wecomPlugin
};
