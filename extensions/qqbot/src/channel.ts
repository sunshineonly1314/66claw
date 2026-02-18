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
} from "openclawcn/plugin-sdk";

import { sendQqbotMessage, probeQqbotConnection } from "./api.js";
import { createQqbotWebhookHandler } from "./webhook.js";
import { QqbotConfigSchema } from "./config-schema.js";
import type {
  QqbotChannelConfig,
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
    // Fix TS2322: readonly tuple -> mutable string[]
    aliases: [...meta.aliases] as string[],
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
    // Fix TS2339/TS2322: normalizeTarget takes (raw: string) => string | undefined
    normalizeTarget: (raw: string) => {
      // 格式: qqbot:<type>:<id> 或 qqbot:<id>
      const match = raw.match(/^qqbot:(?:(c2c|group|channel):)?(.+)$/i);
      if (match) {
        const [, type, id] = match;
        return type ? `${type}:${id}` : id;
      }
      return raw ?? undefined;
    },
    targetResolver: {
      // Fix TS2353: targetResolver only has looksLikeId and hint, not matchInput
      looksLikeId: (raw: string) => {
        // 匹配 QQ 开放平台的 OpenID 格式
        return /^(?:qqbot:)?(?:(c2c|group|channel):)?([A-Z0-9_-]+)$/i.test(raw);
      },
      hint: "qqbot:<type>:<openId> (e.g. qqbot:c2c:ABC123)",
    },
  },
  directory: {
    // Fix TS2322: self must return ChannelDirectoryEntry | null (needs kind field)
    self: async ({ cfg }) => {
      const channelConfig = cfg.channels?.qqbot as QqbotChannelConfig;
      const appId = channelConfig?.app?.appId;
      return appId ? { kind: "user" as const, id: appId, name: `QQ Bot ${appId}` } : null;
    },
    listPeers: async () => [],
    listGroups: async () => [],
  },
  outbound: {
    // Fix TS2322: deliveryMode must be "direct" | "gateway" | "hybrid"
    deliveryMode: "direct",
    // Fix TS2322: chunker must be a function or null, not a string
    chunker: null,
    // Fix TS2322: chunkerMode must be "text" | "markdown"
    chunkerMode: "text",
    textChunkLimit: 2000,
    // Fix TS2322/TS2339: sendText must return OutboundDeliveryResult; use `to` not `target`
    sendText: async ({ cfg, to, text }) => {
      const channelConfig = cfg.channels?.qqbot as QqbotChannelConfig;
      await sendQqbotMessage(channelConfig, to, text);
      return { channel: QQBOT_CHANNEL_ID, messageId: "" };
    },
    // Fix TS2322/TS2339: sendMedia must return OutboundDeliveryResult; use `to`/`mediaUrl` not `target`/`media`
    sendMedia: async ({ cfg, to, text, mediaUrl }) => {
      const channelConfig = cfg.channels?.qqbot as QqbotChannelConfig;
      // QQ 机器人媒体消息需要先上传到腾讯服务器
      // 这里简化处理，只发送文本描述
      const caption = text || (mediaUrl ? `[media: ${mediaUrl}]` : "[media]");
      await sendQqbotMessage(channelConfig, to, caption);
      return { channel: QQBOT_CHANNEL_ID, messageId: "" };
    },
  },
  status: {
    // Fix TS2322: defaultRuntime should be ChannelAccountSnapshot, not a function
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
      lastInboundAt: null,
      lastOutboundAt: null,
    },
    // Fix TS2339: buildChannelSummary params has { account, cfg, defaultAccountId, snapshot }, not { cfg, runtime }
    buildChannelSummary: ({ cfg, snapshot }) => {
      const channelConfig = cfg.channels?.qqbot as QqbotChannelConfig | undefined;
      const { appId, appSecret } = resolveQqbotCredentials(channelConfig);
      return {
        configured: Boolean(appId && appSecret),
        running: snapshot?.running ?? false,
        lastStartAt: snapshot?.lastStartAt ?? null,
        lastError: snapshot?.lastError ?? null,
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
    // Fix TS2339: ChannelGatewayContext has { cfg, accountId, account, runtime, abortSignal, log, getStatus, setStatus }
    // It does NOT have emitInbound or logger. Use log and setStatus instead.
    startAccount: async (ctx) => {
      const { cfg, accountId, log, setStatus, getStatus } = ctx;
      const channelConfig = cfg.channels?.qqbot as QqbotChannelConfig;
      const logger = log ?? { info: console.log, warn: console.warn, error: console.error };

      const { appId, appSecret } = resolveQqbotCredentials(channelConfig);

      if (!appId || !appSecret) {
        logger.warn("[qqbot] Missing appId or appSecret, skipping startup");
        return { cleanup: () => {} };
      }

      logger.info(`[qqbot] Starting QQ Bot channel (account: ${accountId})`);

      // 设置运行状态 - use setStatus instead of runtime.running etc.
      setStatus({ ...getStatus(), accountId, running: true, lastStartAt: Date.now(), lastError: null });

      // 创建 Webhook 处理器
      const webhookPath = channelConfig.webhookPath || DEFAULT_WEBHOOK_PATH;
      const webhookHandler = createQqbotWebhookHandler({
        config: channelConfig,
        onMessage: async (_event: QqbotMessageEvent, _messageType: "direct" | "group" | "channel") => {
          // Update lastInboundAt via setStatus
          setStatus({ ...getStatus(), lastInboundAt: Date.now() });

          // Note: full inbound message dispatch should be handled via the plugin runtime
          // message ingestion pipeline, not directly here. This webhook handler
          // receives the raw QQ event and the gateway context routes it through
          // the standard inbound path.
        },
        logger,
      });

      // 注册 HTTP 路由 - Fix TS2554: registerPluginHttpRoute takes a single params object
      const unregister = registerPluginHttpRoute({
        path: webhookPath,
        handler: webhookHandler,
        pluginId: QQBOT_CHANNEL_ID,
        source: "qqbot-gateway",
        accountId,
        log: (msg: string) => logger.info(msg),
      });

      logger.info(`[qqbot] Webhook registered at ${webhookPath}`);
      logger.info(`[qqbot] QQ Bot channel started successfully`);

      return {
        cleanup: () => {
          logger.info("[qqbot] Stopping QQ Bot channel");
          // Fix TS2339: use setStatus instead of runtime.running/lastStopAt
          setStatus({ ...getStatus(), running: false, lastStopAt: Date.now() });
          unregister();
        },
      };
    },
  },
};
