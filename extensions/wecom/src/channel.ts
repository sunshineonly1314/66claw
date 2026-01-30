/**
 * 企业微信渠道插件核心实现
 * WeCom (WeChat Work) Channel Plugin Core Implementation
 *
 * 文档参考:
 * - 企业微信开放平台: https://developer.work.weixin.qq.com/
 * - 自建应用: https://developer.work.weixin.qq.com/document/path/90556
 * - 应用消息: https://developer.work.weixin.qq.com/document/path/90236
 * - 回调通知: https://developer.work.weixin.qq.com/document/path/90930
 */

import {
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  PAIRING_APPROVED_MESSAGE,
  registerPluginHttpRoute,
  type ChannelPlugin,
  type ClawdbotConfig,
} from "clawdbot/plugin-sdk";

import { getWecomRuntime } from "./runtime.js";
import { sendWecomMessage, probeWecomConnection } from "./api.js";
import { createWecomWebhookHandler } from "./webhook.js";
import { WecomConfigSchema } from "./config-schema.js";
import type {
  WecomChannelConfig,
  WecomProbeResult,
  ResolvedWecomAccount,
} from "./types.js";

// ============================================================================
// 常量定义 (Constants)
// ============================================================================

const WECOM_CHANNEL_ID = "wecom";
const DEFAULT_WEBHOOK_PATH = "/wecom/webhook";

// ============================================================================
// 元数据 (Metadata)
// ============================================================================

const meta = {
  id: WECOM_CHANNEL_ID,
  label: "企业微信",
  selectionLabel: "企业微信 (WeCom)",
  docsPath: "/channels/wecom",
  docsLabel: "wecom",
  blurb: "企业微信自建应用消息",
  aliases: ["wecom", "wechat-work", "wxwork"],
  order: -1, // 国内渠道优先：飞书 > 钉钉 > 企业微信 > WhatsApp...
} as const;

// ============================================================================
// 辅助函数 (Helper Functions)
// ============================================================================

/**
 * 解析企业微信账户配置
 */
function resolveWecomAccount(params: {
  cfg: ClawdbotConfig;
  accountId?: string | null;
}): ResolvedWecomAccount {
  const { cfg, accountId } = params;
  const resolvedAccountId = accountId ?? DEFAULT_ACCOUNT_ID;
  const channelConfig = cfg.channels?.wecom as WecomChannelConfig | undefined;

  const corpId = channelConfig?.app?.corpId ?? null;
  const agentId = channelConfig?.app?.agentId ?? null;
  const agentSecret = channelConfig?.app?.agentSecret ?? null;

  return {
    accountId: resolvedAccountId,
    enabled: channelConfig?.enabled !== false,
    configured: Boolean(corpId && agentId && agentSecret),
    corpId,
    agentId,
    agentSecret,
    config: channelConfig ?? {},
  };
}

/**
 * 解析企业微信应用凭证
 */
function resolveWecomCredentials(config?: WecomChannelConfig): {
  corpId: string | null;
  agentId: number | null;
  agentSecret: string | null;
} {
  return {
    corpId: config?.app?.corpId ?? null,
    agentId: config?.app?.agentId ?? null,
    agentSecret: config?.app?.agentSecret ?? null,
  };
}

// ============================================================================
// 渠道插件定义 (Channel Plugin Definition)
// ============================================================================

export const wecomPlugin: ChannelPlugin<ResolvedWecomAccount> = {
  id: WECOM_CHANNEL_ID,
  meta: {
    ...meta,
  },
  pairing: {
    idLabel: "wecomUserId",
    normalizeAllowEntry: (entry) => entry.replace(/^(wecom|wxwork):/i, ""),
    notifyApproval: async ({ cfg, id }) => {
      const channelConfig = cfg.channels?.wecom as WecomChannelConfig;
      await sendWecomMessage(channelConfig, id, PAIRING_APPROVED_MESSAGE);
    },
  },
  capabilities: {
    chatTypes: ["direct"],
    media: false, // 企业微信应用消息暂不支持富媒体
  },
  reload: { configPrefixes: ["channels.wecom"] },
  configSchema: buildChannelConfigSchema(WecomConfigSchema),
  config: {
    listAccountIds: () => [DEFAULT_ACCOUNT_ID],
    resolveAccount: (cfg, accountId) => resolveWecomAccount({ cfg, accountId }),
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    setAccountEnabled: ({ cfg, enabled }) => ({
      ...cfg,
      channels: {
        ...cfg.channels,
        wecom: {
          ...(cfg.channels?.wecom as WecomChannelConfig),
          enabled,
        },
      },
    }),
    deleteAccount: ({ cfg }) => {
      const next = { ...cfg } as ClawdbotConfig;
      const nextChannels = { ...cfg.channels };
      delete nextChannels.wecom;
      if (Object.keys(nextChannels).length > 0) {
        next.channels = nextChannels;
      } else {
        delete next.channels;
      }
      return next;
    },
    isConfigured: (_account, cfg) => {
      const { corpId, agentId, agentSecret } = resolveWecomCredentials(cfg.channels?.wecom as WecomChannelConfig);
      return Boolean(corpId && agentId && agentSecret);
    },
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
    }),
    resolveAllowFrom: ({ cfg }) => (cfg.channels?.wecom as WecomChannelConfig)?.allowFrom ?? [],
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.toLowerCase()),
  },
  security: {
    collectWarnings: ({ cfg }) => {
      const channelConfig = cfg.channels?.wecom as WecomChannelConfig | undefined;
      const defaultDmPolicy = cfg.channels?.defaults?.dmPolicy;
      const dmPolicy = channelConfig?.dmPolicy ?? defaultDmPolicy ?? "allowlist";
      if (dmPolicy !== "open") return [];
      return [
        `- 企业微信: dmPolicy="open" 允许任何企业成员发送消息。建议设置 channels.wecom.dmPolicy="allowlist" + channels.wecom.allowFrom 来限制。`,
      ];
    },
  },
  messaging: {
    normalizeTarget: (raw) => {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      return trimmed;
    },
    targetResolver: {
      looksLikeId: (raw) => {
        const trimmed = raw.trim();
        // 企业微信 UserId 通常是字母数字组合
        return trimmed.length > 0 && /^[a-zA-Z0-9_-]+$/.test(trimmed);
      },
      hint: "<userId>",
    },
  },
  directory: {
    self: async () => null,
    listPeers: async ({ cfg, query, limit }) => {
      const q = query?.trim().toLowerCase() || "";
      const channelConfig = cfg.channels?.wecom as WecomChannelConfig | undefined;
      const ids = new Set<string>();
      for (const entry of channelConfig?.allowFrom ?? []) {
        const trimmed = String(entry).trim();
        if (trimmed && trimmed !== "*") ids.add(trimmed);
      }
      return Array.from(ids)
        .filter((id) => (q ? id.toLowerCase().includes(q) : true))
        .slice(0, limit && limit > 0 ? limit : undefined)
        .map((id) => ({ kind: "user", id }) as const);
    },
    listGroups: async () => {
      // 企业微信应用消息主要面向用户，暂不支持群聊列表
      return [];
    },
  },
  outbound: {
    deliveryMode: "direct",
    chunker: (text, limit) => getWecomRuntime().channel.text.chunkMarkdownText(text, limit),
    chunkerMode: "markdown",
    textChunkLimit: 2048, // 企业微信文本消息限制
    sendText: async ({ to, text, cfg }) => {
      const channelConfig = cfg.channels?.wecom as WecomChannelConfig;
      const result = await sendWecomMessage(channelConfig, to, text, {
        msgType: "text",
      });
      return { channel: WECOM_CHANNEL_ID, ...result };
    },
    sendMedia: async ({ to, text, cfg }) => {
      // 暂时用文本消息代替
      const channelConfig = cfg.channels?.wecom as WecomChannelConfig;
      const result = await sendWecomMessage(channelConfig, to, text);
      return { channel: WECOM_CHANNEL_ID, ...result };
    },
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null,
    }),
    probeAccount: async ({ cfg }) => {
      const channelConfig = cfg.channels?.wecom as WecomChannelConfig;
      return await probeWecomConnection(channelConfig) as WecomProbeResult;
    },
    buildAccountSnapshot: ({ account, runtime, probe }) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      probe,
    }),
  },
  gateway: {
    startAccount: async (ctx) => {
      const runtime = getWecomRuntime();
      const channelConfig = ctx.cfg.channels?.wecom as WecomChannelConfig | undefined;
      const webhookPath = channelConfig?.webhookPath ?? DEFAULT_WEBHOOK_PATH;

      ctx.log?.info(`[wecom] 启动企业微信渠道 (账户: ${ctx.accountId})`);
      ctx.log?.info(`[wecom] Webhook 路径: ${webhookPath}`);

      // 创建 Webhook 处理器
      const handler = createWecomWebhookHandler({
        config: channelConfig ?? {},
        log: ctx.log,
        onMessage: async (msg) => {
          ctx.log?.info(`[wecom] 收到消息: from=${msg.userId}, type=${msg.msgType}`);

          // 构建入站消息上下文
          const inboundCtx = {
            Channel: WECOM_CHANNEL_ID,
            AccountId: ctx.accountId,
            MessageId: msg.msgId,
            From: msg.userId,
            SenderId: msg.userId,
            SenderName: msg.userId, // 企业微信回调不包含用户名，用 userId 代替
            Body: msg.text,
            RawBody: msg.text,
            ChatType: "direct" as const,
            Timestamp: msg.createTime * 1000,
          };

          // 使用 dispatchReplyWithBufferedBlockDispatcher 处理消息
          try {
            await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
              ctx: inboundCtx,
              cfg: ctx.cfg,
              dispatcherOptions: {
                deliver: async (payload) => {
                  const text = payload.text ?? "";
                  if (text && channelConfig) {
                    await sendWecomMessage(channelConfig, msg.userId, text);
                    ctx.log?.info(`[wecom] 已回复消息到 ${msg.userId}`);
                  }
                },
                onError: (err) => {
                  ctx.log?.error(`[wecom] 回复错误: ${err}`);
                },
              },
              replyOptions: {},
            });
          } catch (err) {
            ctx.log?.error(`[wecom] 处理消息失败: ${err}`);
          }
        },
      });

      // 注册 HTTP 路由到网关
      const unregister = registerPluginHttpRoute({
        path: webhookPath,
        handler,
        pluginId: WECOM_CHANNEL_ID,
        accountId: ctx.accountId,
        log: (message) => ctx.log?.info(message),
      });

      ctx.log?.info(`[wecom] HTTP 路由已注册: ${webhookPath}`);
      ctx.setStatus({ accountId: ctx.accountId, running: true, lastStartAt: Date.now() });

      // 等待 abort 信号
      return new Promise<void>((resolve) => {
        ctx.abortSignal.addEventListener("abort", () => {
          unregister();
          ctx.log?.info(`[wecom] 企业微信渠道已停止 (账户: ${ctx.accountId})`);
          ctx.setStatus({ accountId: ctx.accountId, running: false, lastStopAt: Date.now() });
          resolve();
        });
      });
    },
  },
};
