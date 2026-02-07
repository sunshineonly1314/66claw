/**
 * QQ 机器人渠道插件核心实现
 * QQ Bot Channel Plugin Core Implementation
 *
 * 基于 QQ 开放平台 API v2
 * 文档参考:
 * - QQ 开放平台: https://q.qq.com/
 * - API 文档: https://q.qq.com/wiki/develop/api-v2/
 */

import {
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  PAIRING_APPROVED_MESSAGE,
  registerPluginHttpRoute,
  type ChannelPlugin,
  type ClawdbotConfig,
} from "clawdbot/plugin-sdk";

import { getQqbotRuntime } from "./runtime.js";
import { sendQqbotMessage, probeQqbotConnection } from "./api.js";
import { createQqbotWebhookHandler } from "./webhook.js";
import { QqbotConfigSchema } from "./config-schema.js";
import type {
  QqbotChannelConfig,
  QqbotProbeResult,
  ResolvedQqbotAccount,
  QqbotMessageEvent,
} from "./types.js";

// ============================================================================
// 常量定义 (Constants)
// ============================================================================

const QQBOT_CHANNEL_ID = "qqbot";
const DEFAULT_WEBHOOK_PATH = "/qqbot/webhook";

// ============================================================================
// 元数据 (Metadata)
// ============================================================================

const meta = {
  id: QQBOT_CHANNEL_ID,
  label: "QQ",
  selectionLabel: "QQ 机器人 (QQ Bot)",
  docsPath: "/channels/qqbot",
  docsLabel: "qqbot",
  blurb: "QQ 机器人 - 支持 QQ 开放平台官方机器人",
  aliases: ["qq", "qqbot"],
  order: -1, // 国内渠道优先：飞书 > 钉钉 > 企业微信 > QQ > 其他...
} as const;

// ============================================================================
// 辅助函数 (Helper Functions)
// ============================================================================

/**
 * 解析 QQ 机器人账户配置
 */
function resolveQqbotAccount(params: {
  cfg: ClawdbotConfig;
  accountId?: string | null;
}): ResolvedQqbotAccount {
  const { cfg, accountId } = params;
  const resolvedAccountId = accountId ?? DEFAULT_ACCOUNT_ID;
  const channelConfig = cfg.channels?.qqbot as QqbotChannelConfig | undefined;

  const appId = channelConfig?.app?.appId ?? null;
  const appSecret = channelConfig?.app?.appSecret ?? null;
  const token = channelConfig?.app?.token ?? null;

  return {
    accountId: resolvedAccountId,
    enabled: channelConfig?.enabled !== false,
    configured: Boolean(appId && appSecret),
    appId,
    appSecret,
    token,
    config: channelConfig ?? {},
  };
}

/**
 * 解析 QQ 机器人应用凭证
 */
function resolveQqbotCredentials(config?: QqbotChannelConfig): {
  appId: string | null;
  appSecret: string | null;
  token: string | null;
} {
  return {
    appId: config?.app?.appId ?? null,
    appSecret: config?.app?.appSecret ?? null,
    token: config?.app?.token ?? null,
  };
}

// ============================================================================
// 渠道插件定义 (Channel Plugin Definition)
// ============================================================================

export const qqbotPlugin: ChannelPlugin<ResolvedQqbotAccount> = {
  id: QQBOT_CHANNEL_ID,
  meta: {
    ...meta,
  },
  pairing: {
    idLabel: "qqUserId",
    normalizeAllowEntry: (entry) => entry.replace(/^(qqbot|qq):/i, ""),
    notifyApproval: async ({ cfg, id }) => {
      const channelConfig = cfg.channels?.qqbot as QqbotChannelConfig;
      await sendQqbotMessage(channelConfig, id, PAIRING_APPROVED_MESSAGE);
    },
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
  },
  reload: { configPrefixes: ["channels.qqbot"] },
  configSchema: buildChannelConfigSchema(QqbotConfigSchema),
  config: {
    listAccountIds: () => [DEFAULT_ACCOUNT_ID],
    resolveAccount: (cfg, accountId) => resolveQqbotAccount({ cfg, accountId }),
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    setAccountEnabled: ({ cfg, enabled }) => ({
      ...cfg,
      channels: {
        ...cfg.channels,
        qqbot: {
          ...(cfg.channels?.qqbot as QqbotChannelConfig),
          enabled,
        },
      },
    }),
    deleteAccount: ({ cfg }) => {
      const next = { ...cfg } as ClawdbotConfig;
      const nextChannels = { ...cfg.channels };
      delete nextChannels.qqbot;
      if (Object.keys(nextChannels).length > 0) {
        next.channels = nextChannels;
      } else {
        delete next.channels;
      }
      return next;
    },
    isConfigured: (_account, cfg) => {
      const { appId, appSecret } = resolveQqbotCredentials(cfg.channels?.qqbot as QqbotChannelConfig);
      return Boolean(appId && appSecret);
    },
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
    }),
    resolveAllowFrom: ({ cfg }) => (cfg.channels?.qqbot as QqbotChannelConfig)?.allowFrom ?? [],
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.toLowerCase()),
  },
  security: {
    collectWarnings: ({ cfg }) => {
      const channelConfig = cfg.channels?.qqbot as QqbotChannelConfig | undefined;
      const warnings: string[] = [];

      if (channelConfig?.enabled !== false) {
        if (channelConfig?.dmPolicy === "open") {
          warnings.push("QQ Bot DM policy is set to 'open' - anyone can message the bot");
        }
        if (channelConfig?.groupPolicy === "open") {
          warnings.push("QQ Bot group policy is set to 'open' - bot responds to all groups");
        }
      }

      return warnings;
    },
  },
  messaging: {
    normalizeTarget: ({ target }) => {
      // 格式: qqbot:<type>:<id> 或 qqbot:<id>
      const match = target.match(/^qqbot:(?:(c2c|group|channel):)?(.+)$/i);
      if (match) {
        const [, type, id] = match;
        return type ? `${type}:${id}` : id;
      }
      return target;
    },
    targetResolver: {
      matchInput: (input) => {
        // 匹配 QQ 开放平台的 OpenID 格式
        const match = input.match(/^(?:qqbot:)?(?:(c2c|group|channel):)?([A-Z0-9_-]+)$/i);
        if (match) {
          const [, type, id] = match;
          return {
            target: type ? `qqbot:${type}:${id}` : `qqbot:${id}`,
            accountId: DEFAULT_ACCOUNT_ID,
          };
        }
        return null;
      },
    },
  },
  directory: {
    self: async ({ cfg }) => {
      const channelConfig = cfg.channels?.qqbot as QqbotChannelConfig;
      const appId = channelConfig?.app?.appId;
      return appId ? { id: appId, label: `QQ Bot ${appId}` } : null;
    },
    listPeers: async () => [],
    listGroups: async () => [],
  },
  outbound: {
    deliveryMode: "push",
    chunker: "simple",
    chunkerMode: "simple",
    textChunkLimit: 2000,
    sendText: async ({ cfg, target, text }) => {
      const channelConfig = cfg.channels?.qqbot as QqbotChannelConfig;
      await sendQqbotMessage(channelConfig, target, text);
    },
    sendMedia: async ({ cfg, target, media }) => {
      const channelConfig = cfg.channels?.qqbot as QqbotChannelConfig;
      // QQ 机器人媒体消息需要先上传到腾讯服务器
      // 这里简化处理，只发送文本描述
      const caption = media.caption || `[${media.type}]`;
      await sendQqbotMessage(channelConfig, target, caption);
    },
  },
  status: {
    defaultRuntime: () => ({
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
      lastInboundAt: null,
      lastOutboundAt: null,
    }),
    buildChannelSummary: ({ cfg, runtime }) => {
      const channelConfig = cfg.channels?.qqbot as QqbotChannelConfig | undefined;
      const { appId, appSecret } = resolveQqbotCredentials(channelConfig);
      return {
        configured: Boolean(appId && appSecret),
        running: runtime?.running ?? false,
        lastStartAt: runtime?.lastStartAt ?? null,
        lastError: runtime?.lastError ?? null,
      };
    },
    probeAccount: async ({ cfg }) => {
      const channelConfig = cfg.channels?.qqbot as QqbotChannelConfig;
      const result = await probeQqbotConnection(channelConfig);
      return {
        ok: result.ok,
        error: result.error,
        status: result.ok ? "connected" : "error",
        botInfo: result.botInfo,
      };
    },
    buildAccountSnapshot: ({ account, runtime }) => ({
      accountId: account.accountId,
      name: account.appId ?? undefined,
      enabled: account.enabled,
      configured: account.configured,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastInboundAt: runtime?.lastInboundAt ?? null,
      lastError: runtime?.lastError ?? null,
    }),
  },
  gateway: {
    startAccount: async ({ cfg, accountId, runtime, emitInbound, logger }) => {
      const channelConfig = cfg.channels?.qqbot as QqbotChannelConfig;
      const log = logger ?? console;

      const { appId, appSecret } = resolveQqbotCredentials(channelConfig);

      if (!appId || !appSecret) {
        log.warn("[qqbot] Missing appId or appSecret, skipping startup");
        return { cleanup: () => {} };
      }

      log.info(`[qqbot] Starting QQ Bot channel (account: ${accountId})`);

      // 设置运行状态
      runtime.running = true;
      runtime.lastStartAt = Date.now();
      runtime.lastError = null;

      // 创建 Webhook 处理器
      const webhookPath = channelConfig.webhookPath || DEFAULT_WEBHOOK_PATH;
      const webhookHandler = createQqbotWebhookHandler({
        config: channelConfig,
        onMessage: async (event: QqbotMessageEvent, messageType: "direct" | "group" | "channel") => {
          runtime.lastInboundAt = Date.now();

          // 构建消息目标
          let target: string;
          if (messageType === "direct") {
            target = `qqbot:c2c:${event.author.id}`;
          } else if (messageType === "group") {
            target = `qqbot:group:${event.group_openid || event.group_id}`;
          } else {
            target = `qqbot:channel:${event.channel_id}`;
          }

          // 发送入站消息
          emitInbound({
            channel: QQBOT_CHANNEL_ID,
            accountId,
            target,
            senderId: event.author.id,
            senderName: event.author.username,
            text: event.content,
            replyToMessageId: event.message_reference?.message_id,
            metadata: {
              messageId: event.id,
              messageType,
              timestamp: event.timestamp,
            },
          });
        },
        logger: log,
      });

      // 注册 HTTP 路由
      const pluginRuntime = getQqbotRuntime();
      registerPluginHttpRoute(pluginRuntime, {
        method: "POST",
        path: webhookPath,
        handler: webhookHandler,
      });

      log.info(`[qqbot] Webhook registered at ${webhookPath}`);
      log.info(`[qqbot] QQ Bot channel started successfully`);

      return {
        cleanup: () => {
          log.info("[qqbot] Stopping QQ Bot channel");
          runtime.running = false;
          runtime.lastStopAt = Date.now();
        },
      };
    },
  },
};
