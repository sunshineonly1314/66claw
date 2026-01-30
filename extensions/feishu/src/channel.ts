/**
 * 飞书渠道插件核心实现
 * Feishu Channel Plugin Core Implementation
 *
 * 文档参考:
 * - 飞书开放平台: https://open.feishu.cn/
 * - 事件订阅: https://open.feishu.cn/document/ukTMukTMukTM/uUTNz4SN1MjL1UzM
 * - 消息API: https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create
 */

import {
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  PAIRING_APPROVED_MESSAGE,
  registerPluginHttpRoute,
  type ChannelPlugin,
  type ClawdbotConfig,
} from "clawdbot/plugin-sdk";

import { getFeishuRuntime } from "./runtime.js";
import { sendFeishuMessage, probeFeishuConnection } from "./api.js";
import { createFeishuWebhookHandler } from "./webhook.js";
import { FeishuConfigSchema } from "./config-schema.js";
import type {
  FeishuChannelConfig,
  FeishuProbeResult,
  ResolvedFeishuAccount,
} from "./types.js";

// ============================================================================
// 常量定义 (Constants)
// ============================================================================

const FEISHU_CHANNEL_ID = "feishu";
const DEFAULT_WEBHOOK_PATH = "/feishu/webhook";

// ============================================================================
// 元数据 (Metadata)
// ============================================================================

const meta = {
  id: FEISHU_CHANNEL_ID,
  label: "飞书",
  selectionLabel: "飞书 (Feishu/Lark)",
  docsPath: "/channels/feishu",
  docsLabel: "feishu",
  blurb: "飞书企业内部应用机器人",
  aliases: ["lark", "feishu"],
  order: -3, // 国内渠道优先：飞书 > 钉钉 > 企业微信 > WhatsApp...
} as const;

// ============================================================================
// 辅助函数 (Helper Functions)
// ============================================================================

/**
 * 解析飞书账户配置
 */
function resolveFeishuAccount(params: {
  cfg: ClawdbotConfig;
  accountId?: string | null;
}): ResolvedFeishuAccount {
  const { cfg, accountId } = params;
  const resolvedAccountId = accountId ?? DEFAULT_ACCOUNT_ID;
  const channelConfig = cfg.channels?.feishu as FeishuChannelConfig | undefined;

  const appId = channelConfig?.app?.appId ?? null;
  const appSecret = channelConfig?.app?.appSecret ?? null;

  return {
    accountId: resolvedAccountId,
    enabled: channelConfig?.enabled !== false,
    configured: Boolean(appId && appSecret),
    appId,
    appSecret,
    config: channelConfig ?? {},
  };
}

/**
 * 解析飞书应用凭证
 */
function resolveFeishuCredentials(config?: FeishuChannelConfig): {
  appId: string | null;
  appSecret: string | null;
} {
  return {
    appId: config?.app?.appId ?? null,
    appSecret: config?.app?.appSecret ?? null,
  };
}

// ============================================================================
// 渠道插件定义 (Channel Plugin Definition)
// ============================================================================

export const feishuPlugin: ChannelPlugin<ResolvedFeishuAccount> = {
  id: FEISHU_CHANNEL_ID,
  meta: {
    ...meta,
  },
  pairing: {
    idLabel: "feishuUserId",
    normalizeAllowEntry: (entry) => entry.replace(/^(feishu|lark):/i, ""),
    notifyApproval: async ({ cfg, id }) => {
      const channelConfig = cfg.channels?.feishu as FeishuChannelConfig;
      await sendFeishuMessage(channelConfig, id, PAIRING_APPROVED_MESSAGE);
    },
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
    threads: true,
  },
  reload: { configPrefixes: ["channels.feishu"] },
  configSchema: buildChannelConfigSchema(FeishuConfigSchema),
  config: {
    listAccountIds: () => [DEFAULT_ACCOUNT_ID],
    resolveAccount: (cfg, accountId) => resolveFeishuAccount({ cfg, accountId }),
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    setAccountEnabled: ({ cfg, enabled }) => ({
      ...cfg,
      channels: {
        ...cfg.channels,
        feishu: {
          ...(cfg.channels?.feishu as FeishuChannelConfig),
          enabled,
        },
      },
    }),
    deleteAccount: ({ cfg }) => {
      const next = { ...cfg } as ClawdbotConfig;
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
      const { appId, appSecret } = resolveFeishuCredentials(cfg.channels?.feishu as FeishuChannelConfig);
      return Boolean(appId && appSecret);
    },
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
    }),
    resolveAllowFrom: ({ cfg }) => (cfg.channels?.feishu as FeishuChannelConfig)?.allowFrom ?? [],
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.toLowerCase()),
  },
  security: {
    collectWarnings: ({ cfg }) => {
      const channelConfig = cfg.channels?.feishu as FeishuChannelConfig | undefined;
      const defaultGroupPolicy = cfg.channels?.defaults?.groupPolicy;
      const groupPolicy = channelConfig?.groupPolicy ?? defaultGroupPolicy ?? "allowlist";
      if (groupPolicy !== "open") return [];
      return [
        `- 飞书群聊: groupPolicy="open" 允许任何群成员触发 (需要 @机器人)。设置 channels.feishu.groupPolicy="allowlist" + channels.feishu.groups 来限制。`,
      ];
    },
  },
  messaging: {
    normalizeTarget: (raw) => {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith("ou_") || trimmed.startsWith("on_") || trimmed.startsWith("oc_")) {
        return trimmed;
      }
      return trimmed;
    },
    targetResolver: {
      looksLikeId: (raw) => {
        const trimmed = raw.trim();
        return /^(ou_|on_|oc_)[a-zA-Z0-9_-]+$/.test(trimmed);
      },
      hint: "<chatId|openId|unionId>",
    },
  },
  directory: {
    self: async () => null,
    listPeers: async ({ cfg, query, limit }) => {
      const q = query?.trim().toLowerCase() || "";
      const channelConfig = cfg.channels?.feishu as FeishuChannelConfig | undefined;
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
    listGroups: async ({ cfg, query, limit }) => {
      const q = query?.trim().toLowerCase() || "";
      const channelConfig = cfg.channels?.feishu as FeishuChannelConfig | undefined;
      const ids = new Set<string>();
      for (const groupId of Object.keys(channelConfig?.groups ?? {})) {
        const trimmed = groupId.trim();
        if (trimmed && trimmed !== "*") ids.add(trimmed);
      }
      return Array.from(ids)
        .filter((id) => (q ? id.toLowerCase().includes(q) : true))
        .slice(0, limit && limit > 0 ? limit : undefined)
        .map((id) => ({ kind: "group", id }) as const);
    },
  },
  outbound: {
    deliveryMode: "direct",
    chunker: (text, limit) => getFeishuRuntime().channel.text.chunkMarkdownText(text, limit),
    chunkerMode: "markdown",
    textChunkLimit: 4000,
    sendText: async ({ to, text, cfg, replyToId }) => {
      const channelConfig = cfg.channels?.feishu as FeishuChannelConfig;
      const result = await sendFeishuMessage(channelConfig, to, text, {
        msgType: "text",
        replyToId: replyToId ?? undefined,
      });
      return { channel: FEISHU_CHANNEL_ID, ...result };
    },
    sendMedia: async ({ to, text, cfg, replyToId }) => {
      const channelConfig = cfg.channels?.feishu as FeishuChannelConfig;
      const result = await sendFeishuMessage(channelConfig, to, text, {
        replyToId: replyToId ?? undefined,
      });
      return { channel: FEISHU_CHANNEL_ID, ...result };
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
      const channelConfig = cfg.channels?.feishu as FeishuChannelConfig;
      return await probeFeishuConnection(channelConfig) as FeishuProbeResult;
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
      const runtime = getFeishuRuntime();
      const channelConfig = ctx.cfg.channels?.feishu as FeishuChannelConfig | undefined;
      const webhookPath = channelConfig?.webhookPath ?? DEFAULT_WEBHOOK_PATH;

      ctx.log?.info(`[feishu] 启动飞书渠道 (账户: ${ctx.accountId})`);
      ctx.log?.info(`[feishu] Webhook 路径: ${webhookPath}`);

      // 创建 Webhook 处理器
      const handler = createFeishuWebhookHandler({
        config: channelConfig ?? {},
        log: ctx.log,
        onMessage: async (msg) => {
          ctx.log?.info(`[feishu] 收到消息: chatType=${msg.chatType}, from=${msg.senderId}`);

          // 构建入站消息上下文 (使用 Body 字段，MsgContext 期望的格式)
          const inboundCtx = {
            Channel: FEISHU_CHANNEL_ID,
            AccountId: ctx.accountId,
            MessageId: msg.messageId,
            From: msg.chatId, // 用于路由和回复
            SenderId: msg.senderId,
            SenderName: msg.senderId,
            Body: msg.text, // MsgContext 使用 Body，不是 Text
            RawBody: msg.text,
            ChatType: msg.chatType === "p2p" ? ("direct" as const) : ("group" as const),
            Timestamp: Date.now(),
          };

          // 使用 dispatchReplyWithBufferedBlockDispatcher 处理消息
          try {
            await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
              ctx: inboundCtx,
              cfg: ctx.cfg,
              dispatcherOptions: {
                deliver: async (payload) => {
                  // 发送回复：单聊用对方 open_id，群聊用 chat_id（符合飞书发送消息 API）
                  const text = payload.text ?? "";
                  if (text) {
                    const to =
                      msg.chatType === "p2p"
                        ? (msg.senderOpenId ?? msg.senderId)
                        : msg.chatId;
                    await sendFeishuMessage(channelConfig ?? {}, to, text);
                    ctx.log?.info(`[feishu] 已回复消息到 ${msg.chatType === "p2p" ? "用户 " + to : "会话 " + msg.chatId}`);
                  }
                },
                onError: (err) => {
                  ctx.log?.error(`[feishu] 回复错误: ${err}`);
                },
              },
              replyOptions: {},
            });
          } catch (err) {
            ctx.log?.error(`[feishu] 处理消息失败: ${err}`);
          }
        },
      });

      // 注册 HTTP 路由到网关
      const unregister = registerPluginHttpRoute({
        path: webhookPath,
        handler,
        pluginId: FEISHU_CHANNEL_ID,
        accountId: ctx.accountId,
        log: (message) => ctx.log?.info(message),
      });

      ctx.log?.info(`[feishu] HTTP 路由已注册: ${webhookPath}`);
      ctx.setStatus({ accountId: ctx.accountId, running: true, lastStartAt: Date.now() });

      // 等待 abort 信号
      return new Promise<void>((resolve) => {
        ctx.abortSignal.addEventListener("abort", () => {
          unregister();
          ctx.log?.info(`[feishu] 飞书渠道已停止 (账户: ${ctx.accountId})`);
          ctx.setStatus({ accountId: ctx.accountId, running: false, lastStopAt: Date.now() });
          resolve();
        });
      });
    },
  },
};
