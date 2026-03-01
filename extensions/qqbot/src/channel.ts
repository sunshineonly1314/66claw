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

import { sendQqbotMessage, probeQqbotConnection, clearTokenCache } from "./api.js";
import { createQqbotWebhookHandler } from "./webhook.js";
import { QqbotConfigSchema } from "./config-schema.js";
import { getQqbotRuntime } from "./runtime.js";
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

// 消息去重缓存 (防止 QQ 平台重试导致重复处理)
const recentMsgIds = new Map<string, number>();
const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 分钟
const DEDUP_MAX_SIZE = 2000;

function isDuplicateMessage(msgId: string): boolean {
  const now = Date.now();
  // 清理过期条目
  if (recentMsgIds.size > DEDUP_MAX_SIZE) {
    for (const [id, ts] of recentMsgIds) {
      if (now - ts > DEDUP_TTL_MS) recentMsgIds.delete(id);
    }
  }
  if (recentMsgIds.has(msgId)) return true;
  recentMsgIds.set(msgId, now);
  return false;
}

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
    media: false, // QQ 机器人媒体消息需要先上传到腾讯服务器，暂未实现
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
      if (!channelConfig || channelConfig.enabled === false) return [];

      const warnings: string[] = [];

      // 签名验证缺失警告
      const publicKey = channelConfig.app?.publicKey?.trim();
      if (!publicKey) {
        warnings.push(
          `- QQ 机器人: 未配置 publicKey，Webhook 回调将跳过 Ed25519 签名验证。建议在 QQ 开放平台获取公钥并设置 channels.qqbot.app.publicKey。`,
        );
      }

      if (channelConfig.dmPolicy === "open") {
        warnings.push(
          `- QQ 机器人: dmPolicy="open" 允许任何用户发送消息。建议设置 channels.qqbot.dmPolicy="allowlist" + channels.qqbot.allowFrom 来限制。`,
        );
      }
      if (channelConfig.groupPolicy === "open") {
        warnings.push(
          `- QQ 机器人群聊: groupPolicy="open" 允许任何群触发。建议设置 channels.qqbot.groupPolicy="allowlist" + channels.qqbot.groups 来限制。`,
        );
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

      const runtime = getQqbotRuntime();

      // 创建 Webhook 处理器
      const webhookPath = channelConfig.webhookPath || DEFAULT_WEBHOOK_PATH;
      const webhookHandler = createQqbotWebhookHandler({
        config: channelConfig,
        onMessage: async (event: QqbotMessageEvent, messageType: "direct" | "group" | "channel") => {
          // 更新最后收到消息时间
          setStatus({ ...getStatus(), lastInboundAt: Date.now() });

          // 消息去重
          if (isDuplicateMessage(event.id)) {
            logger.info(`[qqbot] 跳过重复消息: ${event.id}`);
            return;
          }

          // 过滤机器人自身消息 (防止无限循环)
          if (event.author?.bot) {
            logger.info(`[qqbot] 跳过机器人自身消息: ${event.id}`);
            return;
          }

          const content = (event.content ?? "").trim();
          if (!content) {
            logger.info(`[qqbot] 消息内容为空，跳过: ${event.id}`);
            return;
          }

          // ========================================
          // 访问策略检查
          // ========================================
          const dmPolicy = channelConfig.dmPolicy ?? "pairing";
          const groupPolicy = channelConfig.groupPolicy ?? "allowlist";
          const allowFrom = channelConfig.allowFrom ?? [];

          if (messageType === "direct") {
            // DM 策略检查
            if (dmPolicy === "allowlist") {
              const senderId = event.author?.id ?? "";
              const isAllowed = allowFrom.includes("*") || allowFrom.includes(senderId);
              if (!isAllowed) {
                logger.info(`[qqbot] 用户 ${senderId} 不在 DM 白名单中，跳过`);
                return;
              }
            }
          } else if (messageType === "group") {
            // 群聊策略检查
            const groupId = event.group_openid ?? event.group_id ?? "";
            if (groupPolicy === "allowlist" && groupId) {
              const groupConfig = channelConfig.groups?.[groupId];
              const groupAllowFrom = groupConfig?.allowFrom ?? [];
              // 群级别发送者白名单
              if (groupAllowFrom.length > 0) {
                const senderId = event.author?.id ?? "";
                const isAllowed = groupAllowFrom.includes("*") || groupAllowFrom.includes(senderId);
                if (!isAllowed) {
                  logger.info(`[qqbot] 用户 ${senderId} 不在群 ${groupId} 白名单中，跳过`);
                  return;
                }
              }
            }
          }

          // ========================================
          // 构建入站消息上下文并分发
          // ========================================
          const senderId = event.author?.id ?? "unknown";
          const senderName = event.author?.username ?? senderId;
          const chatType = messageType === "direct" ? "direct" as const : "group" as const;

          // 构建回复目标
          let replyTarget: string;
          if (messageType === "group") {
            const groupId = event.group_openid ?? event.group_id ?? "";
            if (!groupId) {
              logger.warn(`[qqbot] 群消息缺少 group_openid/group_id，跳过`);
              return;
            }
            replyTarget = `group:${groupId}`;
          } else if (messageType === "channel") {
            const channelId = event.channel_id ?? "";
            if (!channelId) {
              logger.warn(`[qqbot] 频道消息缺少 channel_id，跳过`);
              return;
            }
            replyTarget = `channel:${channelId}`;
          } else {
            replyTarget = `c2c:${senderId}`;
          }

          const inboundCtx = {
            Channel: QQBOT_CHANNEL_ID,
            AccountId: accountId,
            MessageId: event.id,
            From: replyTarget,
            SenderId: senderId,
            SenderName: senderName,
            Body: content,
            RawBody: content,
            ChatType: chatType,
            ChatId: event.group_openid ?? event.group_id ?? event.channel_id ?? undefined,
            To: replyTarget,
            Timestamp: event.timestamp ? new Date(event.timestamp).getTime() : Date.now(),
          };

          try {
            await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
              ctx: inboundCtx,
              cfg,
              dispatcherOptions: {
                deliver: async (payload) => {
                  const text = payload.text ?? "";
                  if (text) {
                    await sendQqbotMessage(channelConfig, replyTarget, text, event.id);
                    logger.info(`[qqbot] 已回复消息到 ${replyTarget}`);
                  }
                },
                onError: (err) => {
                  logger.error(`[qqbot] 回复错误: ${err}`);
                },
              },
              replyOptions: {},
            });
          } catch (err) {
            logger.error(`[qqbot] 处理消息失败: ${err}`);
          }
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
