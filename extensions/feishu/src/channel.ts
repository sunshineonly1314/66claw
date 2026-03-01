/**
 * 飞书渠道插件核心实现
 * Feishu Channel Plugin Core Implementation
 *
 * 融合自 m1heng/clawdbot-feishu 的增强功能:
 * - WebSocket 长连接支持
 * - 媒体上传下载
 * - 卡片渲染模式
 * - @ 提及转发
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
} from "openclawcn/plugin-sdk";

import { getFeishuRuntime } from "./runtime.js";
import { sendFeishuMessage, probeFeishuConnection, sendMarkdownCardFeishu, countGroupBots } from "./api.js";
import { createFeishuWebhookHandler, resolveFeishuInboundMedia, feishuMediaPlaceholder, extractPostContent } from "./webhook.js";
import { monitorFeishuProvider, getCurrentBotOpenId } from "./monitor.js";
import { sendMediaFeishu } from "./media.js";
import { resolveFeishuCredentials } from "./client.js";
import { normalizeFeishuTarget, looksLikeFeishuId } from "./targets.js";
import { MessageDedup } from "./dedup.js";
import { FeishuConfigSchema } from "./config-schema.js";
import type {
  FeishuChannelConfig,
  FeishuProbeResult,
  ResolvedFeishuAccount,
  FeishuDomain,
  FeishuTextContent,
  FeishuPostContent,
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
  order: -4, // 国内渠道优先：飞书 > 钉钉 > 企业微信 > QQ > 其他...
} as const;

// ============================================================================
// 辅助函数 (Helper Functions)
// ============================================================================

/**
 * 解析飞书账户配置
 * 支持新版扁平配置和旧版嵌套配置
 */
function resolveFeishuAccountInternal(params: {
  cfg: ClawdbotConfig;
  accountId?: string | null;
}): ResolvedFeishuAccount {
  const { cfg, accountId } = params;
  const resolvedAccountId = accountId ?? DEFAULT_ACCOUNT_ID;
  const channelConfig = cfg.channels?.feishu as FeishuChannelConfig | undefined;

  // 使用统一的凭证解析函数
  const creds = resolveFeishuCredentials(channelConfig);

  return {
    accountId: resolvedAccountId,
    enabled: channelConfig?.enabled !== false,
    configured: Boolean(creds),
    appId: creds?.appId ?? null,
    appSecret: creds?.appSecret ?? null,
    config: channelConfig ?? {},
    domain: creds?.domain ?? "feishu",
  };
}

/**
 * 检测是否应该使用卡片渲染
 */
function shouldUseCard(text: string, renderMode?: "auto" | "raw" | "card"): boolean {
  if (renderMode === "card") return true;
  if (renderMode === "raw") return false;
  // auto 模式：检测代码块或表格
  if (/```[\s\S]*?```/.test(text)) return true;
  if (/\|.+\|[\r\n]+\|[-:| ]+\|/.test(text)) return true;
  return false;
}

// ============================================================================
// 渠道插件定义 (Channel Plugin Definition)
// ============================================================================

export const feishuPlugin: ChannelPlugin<ResolvedFeishuAccount> = {
  id: FEISHU_CHANNEL_ID,
  meta: {
    ...meta,
    aliases: [...meta.aliases] as string[],
  },
  pairing: {
    idLabel: "feishuUserId",
    normalizeAllowEntry: (entry) => entry.replace(/^(feishu|lark|user|open_id):/i, ""),
    notifyApproval: async ({ cfg, id }) => {
      const channelConfig = cfg.channels?.feishu as FeishuChannelConfig;
      await sendFeishuMessage(channelConfig, id, PAIRING_APPROVED_MESSAGE);
    },
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
    threads: true,
    reactions: true,
    edit: true,
    reply: true,
  },
  agentPrompt: {
    messageToolHints: () => [
      "- 飞书目标: 省略 `target` 自动回复当前会话。显式目标: `user:open_id` 或 `chat:chat_id`。",
      "- 飞书支持卡片消息用于富文本渲染。",
    ],
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
          ...(cfg.channels?.feishu as FeishuChannelConfig),
          enabled,
        },
      },
    }),
    deleteAccount: ({ cfg }) => {
      const next = { ...cfg } as ClawdbotConfig;
      const nextChannels = { ...cfg.channels };
      delete (nextChannels as Record<string, unknown>).feishu;
      if (Object.keys(nextChannels).length > 0) {
        next.channels = nextChannels;
      } else {
        delete next.channels;
      }
      return next;
    },
    isConfigured: (_account, cfg) => {
      const creds = resolveFeishuCredentials(cfg.channels?.feishu as FeishuChannelConfig);
      return Boolean(creds);
    },
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      domain: account.domain,
    }),
    resolveAllowFrom: ({ cfg }) =>
      ((cfg.channels?.feishu as FeishuChannelConfig)?.allowFrom ?? []).map(String),
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.toLowerCase()),
  },
  security: {
    collectWarnings: ({ cfg }) => {
      const channelConfig = cfg.channels?.feishu as FeishuChannelConfig | undefined;
      if (!channelConfig || channelConfig.enabled === false) return [];

      const warnings: string[] = [];

      // 签名验证缺失警告
      const verificationToken =
        channelConfig.verificationToken?.trim() || channelConfig.app?.verificationToken?.trim();
      if (!verificationToken) {
        warnings.push(
          `- 飞书: 未配置 verificationToken，Webhook 回调将跳过签名验证。建议在飞书开放平台获取 Verification Token 并设置 channels.feishu.verificationToken。`,
        );
      }

      const defaultGroupPolicy = cfg.channels?.defaults?.groupPolicy;
      const groupPolicy = channelConfig.groupPolicy ?? defaultGroupPolicy ?? "allowlist";
      if (groupPolicy === "open") {
        warnings.push(
          `- 飞书群聊: groupPolicy="open" 允许任何群成员触发 (需要 @机器人)。设置 channels.feishu.groupPolicy="allowlist" + channels.feishu.groups 来限制。`,
        );
      }

      return warnings;
    },
  },
  messaging: {
    normalizeTarget: (raw: string) => normalizeFeishuTarget(raw) ?? undefined,
    targetResolver: {
      looksLikeId: looksLikeFeishuId,
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
      const renderMode = channelConfig?.renderMode ?? "auto";

      // 根据渲染模式选择发送方式
      if (shouldUseCard(text, renderMode)) {
        const result = await sendMarkdownCardFeishu({
          config: channelConfig,
          to,
          text,
          replyToMessageId: replyToId ?? undefined,
        });
        return { channel: FEISHU_CHANNEL_ID, ...result };
      }

      const result = await sendFeishuMessage(channelConfig, to, text, {
        msgType: "text",
        replyToId: replyToId ?? undefined,
      });
      return { channel: FEISHU_CHANNEL_ID, ...result };
    },
    sendMedia: async ({ to, text, cfg, replyToId, mediaUrl }) => {
      const channelConfig = cfg.channels?.feishu as FeishuChannelConfig;

      // 先发送文本
      if (text?.trim()) {
        await sendFeishuMessage(channelConfig, to, text, {
          replyToId: replyToId ?? undefined,
        });
      }

      // 发送媒体
      if (mediaUrl) {
        try {
          const result = await sendMediaFeishu({
            cfg: channelConfig,
            to,
            mediaUrl,
            replyToMessageId: replyToId ?? undefined,
          });
          return { channel: FEISHU_CHANNEL_ID, ...result };
        } catch (err) {
          // 上传失败时回退到链接
          console.error(`[feishu] 媒体上传失败:`, err);
          const fallbackText = `📎 ${mediaUrl}`;
          const result = await sendFeishuMessage(channelConfig, to, fallbackText);
          return { channel: FEISHU_CHANNEL_ID, ...result };
        }
      }

      // 没有媒体 URL，只返回文本结果
      const result = await sendFeishuMessage(channelConfig, to, text ?? "");
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
      const connectionMode = channelConfig?.connectionMode ?? "websocket";
      const webhookPath = channelConfig?.webhookPath ?? DEFAULT_WEBHOOK_PATH;
      const port = channelConfig?.webhookPort ?? null;

      ctx.log?.info(`[feishu] 启动飞书渠道 (账户: ${ctx.accountId}, 模式: ${connectionMode})`);
      ctx.setStatus({ accountId: ctx.accountId, running: true, lastStartAt: Date.now(), port });

      // 消息处理函数 (WebSocket 和 Webhook 共用)
      // 消息去重：Map + TTL + LRU 淘汰，防止飞书超时重试导致重复处理
      const dedup = new MessageDedup();
      dedup.start();

      const handleMessage = async (msg: {
        messageId: string;
        chatId: string;
        chatType: "p2p" | "group";
        senderId: string;
        senderOpenId?: string;
        senderName?: string;
        text: string;
        mediaPath?: string;
        mediaType?: string;
        /** 本机器人是否被 @ 提及 */
        mentionedBot?: boolean;
      }) => {
        // 扩展层去重：相同 messageId 在 TTL 内只处理一次（带作用域隔离 + LRU 淘汰）
        if (!dedup.tryRecord(msg.messageId, msg.chatId)) {
          ctx.log?.info(`[feishu] 跳过重复消息: messageId=${msg.messageId}`);
          return;
        }

        // 多机器人群聊安全检查：当群里有多个机器人时，必须 @本机器人才响应
        // 防止机器人之间互相触发造成消息风暴
        if (
          msg.chatType === "group" &&
          !msg.mentionedBot &&
          !(channelConfig?.advanced?.allowMentionlessInMultiBotGroup ?? false)
        ) {
          try {
            const botCount = await countGroupBots(channelConfig ?? {}, msg.chatId);
            if (botCount > 1) {
              ctx.log?.info(
                `[feishu] 多机器人群 (${botCount} bots) 未 @本机器人，跳过: chatId=${msg.chatId}`,
              );
              return;
            }
          } catch (err) {
            ctx.log?.warn?.(`[feishu] 查询群机器人数量失败: ${err}`);
            // 查询失败时不阻断消息处理
          }
        }

        ctx.log?.info(`[feishu] 收到消息: chatType=${msg.chatType}, from=${msg.senderId}`);

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
          ChatType: msg.chatType === "p2p" ? ("direct" as const) : ("group" as const),
          Timestamp: Date.now(),
          MediaPath: msg.mediaPath,
          MediaType: msg.mediaType,
          MediaUrl: msg.mediaPath,
          MediaPaths: msg.mediaPath ? [msg.mediaPath] : undefined,
          MediaUrls: msg.mediaPath ? [msg.mediaPath] : undefined,
          MediaTypes: msg.mediaType ? [msg.mediaType] : undefined,
        };

        try {
          await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
            ctx: inboundCtx,
            cfg: ctx.cfg,
            dispatcherOptions: {
              deliver: async (payload) => {
                const text = payload.text ?? "";
                if (text) {
                  const to = msg.chatType === "p2p"
                    ? (msg.senderOpenId ?? msg.senderId)
                    : msg.chatId;
                  const renderMode = channelConfig?.renderMode ?? "auto";

                  // 根据渲染模式选择发送方式
                  if (shouldUseCard(text, renderMode)) {
                    await sendMarkdownCardFeishu({
                      config: channelConfig ?? {},
                      to,
                      text,
                    });
                  } else {
                    await sendFeishuMessage(channelConfig ?? {}, to, text);
                  }
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
      };

      // 根据连接模式启动
      if (connectionMode === "websocket") {
        // WebSocket 长连接模式 (推荐)
        ctx.log?.info(`[feishu] 使用 WebSocket 长连接模式`);

        return monitorFeishuProvider({
          config: ctx.cfg,
          log: (msg) => ctx.log?.info(msg),
          error: (msg) => ctx.log?.error(msg),
          abortSignal: ctx.abortSignal,
          accountId: ctx.accountId,
          onMessage: async (event) => {
            const msgType = event.message.message_type;
            let text = "";
            let mediaPath: string | undefined;
            let mediaType: string | undefined;

            let content: Record<string, unknown> | undefined;
            try {
              content = JSON.parse(event.message.content);
            } catch {
              // content 解析失败，降级为原始字符串
              text = event.message.content;
            }

            if (content) {
              if (msgType === "text") {
                text = (content as unknown as FeishuTextContent).text ?? "";
              } else if (msgType === "post") {
                try {
                  const { text: postText, imageKeys } = extractPostContent(content as FeishuPostContent);
                  text = postText;
                  if (imageKeys.length > 0) {
                    const media = await resolveFeishuInboundMedia({
                      config: channelConfig ?? {},
                      messageId: event.message.message_id,
                      messageType: "image",
                      content: { image_key: imageKeys[0] } as unknown as Record<string, unknown>,
                      log: { info: (m) => ctx.log?.info(m), warn: (m) => ctx.log?.info(m), error: (m) => ctx.log?.error(m) },
                    });
                    if (media) { mediaPath = media.path; mediaType = media.contentType; }
                  }
                } catch (err) {
                  ctx.log?.error(`[feishu] WebSocket 解析富文本失败: ${err}`);
                  text = event.message.content;
                }
              } else if (["image", "file", "audio", "media", "sticker"].includes(msgType)) {
                text = feishuMediaPlaceholder(msgType);
                try {
                  const media = await resolveFeishuInboundMedia({
                    config: channelConfig ?? {},
                    messageId: event.message.message_id,
                    messageType: msgType,
                    content,
                    log: { info: (m) => ctx.log?.info(m), warn: (m) => ctx.log?.info(m), error: (m) => ctx.log?.error(m) },
                  });
                  if (media) { mediaPath = media.path; mediaType = media.contentType; }
                } catch (err) {
                  ctx.log?.error(`[feishu] WebSocket 下载媒体失败 (${msgType}): ${err}`);
                }
              } else {
                ctx.log?.info(`[feishu] WebSocket 收到不支持的消息类型: ${msgType}`);
                return;
              }
            }

            // 检测是否 @本机器人 & 移除 @ 机器人的占位符
            const botOpenId = getCurrentBotOpenId();
            let mentionedBot = false;
            if (event.message.mentions) {
              for (const m of event.message.mentions) {
                if (botOpenId && m.id.open_id === botOpenId) {
                  mentionedBot = true;
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
              text,
              mediaPath,
              mediaType,
              mentionedBot,
            });
          },
        });
      }

      // Webhook 模式
      ctx.log?.info(`[feishu] 使用 Webhook 模式, 路径: ${webhookPath}`);

      const handler = createFeishuWebhookHandler({
        config: channelConfig ?? {},
        log: ctx.log,
        onMessage: async (msg) => {
          // Webhook 模式下，mentions 不为空说明有 @，但我们无法精确判断是否 @本机器人
          // 飞书 webhook handler 已在 handleMessageEvent 中移除了 @本机器人的占位符
          // 简化判断：有 mentions 就认为是 @本机器人（因为 webhook.ts 只处理与本机器人相关的事件）
          const mentionedBot = (msg.mentions && msg.mentions.length > 0) || false;
          await handleMessage({
            messageId: msg.messageId,
            chatId: msg.chatId,
            chatType: msg.chatType,
            senderId: msg.senderId,
            senderOpenId: msg.senderOpenId,
            text: msg.text,
            mediaPath: msg.mediaPath,
            mediaType: msg.mediaType,
            mentionedBot,
          });
        },
      });

      const unregister = registerPluginHttpRoute({
        path: webhookPath,
        handler,
        pluginId: FEISHU_CHANNEL_ID,
        accountId: ctx.accountId,
        log: (message) => ctx.log?.info(message),
      });

      ctx.log?.info(`[feishu] HTTP 路由已注册: ${webhookPath}`);

      return new Promise<void>((resolve) => {
        ctx.abortSignal.addEventListener("abort", () => {
          unregister();
          dedup.stop();
          ctx.log?.info(`[feishu] 飞书渠道已停止 (账户: ${ctx.accountId})`);
          ctx.setStatus({ accountId: ctx.accountId, running: false, lastStopAt: Date.now() });
          resolve();
        });
      });
    },
  },
};
