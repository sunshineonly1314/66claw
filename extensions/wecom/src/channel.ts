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
} from "openclawcn/plugin-sdk";

import { getWecomRuntime } from "./runtime.js";
import { sendWecomMessage, sendWecomGroupMessage, probeWecomConnection } from "./api.js";
import { createWecomWebhookHandler } from "./webhook.js";
import { WecomConfigSchema } from "./config-schema.js";
import type {
  WecomAccountConfig,
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
  order: -2, // 国内渠道优先：飞书 > 钉钉 > 企业微信 > QQ > 其他...
} as const;

// ============================================================================
// 辅助函数 (Helper Functions)
// ============================================================================

/**
 * 检查消息是否 @了机器人
 *
 * 企业微信群聊中，@机器人 的消息格式可能包含:
 * 1. @机器人名称 后跟消息内容
 * 2. 特殊的提及标记
 *
 * 由于企业微信智能机器人回调的限制，这里使用简化的检测逻辑:
 * - 如果消息以 @ 开头，认为是提及消息
 * - 或者消息中包含 @机器人 相关标识
 *
 * @param text - 消息文本
 * @param _config - 渠道配置 (保留参数，用于扩展)
 * @returns 是否提及了机器人
 */
function checkBotMentioned(text: string, _config?: WecomChannelConfig): boolean {
  if (!text) return false;

  const trimmed = text.trim();

  // 检查消息是否以 @ 开头 (最常见的提及方式)
  if (trimmed.startsWith("@")) {
    return true;
  }

  // 检查消息中是否包含 @ 符号 (可能在中间提及)
  // 注意: 这是一个宽松的检测，实际场景可能需要更精确的匹配
  if (trimmed.includes("@")) {
    return true;
  }

  // 如果没有检测到 @，返回 false
  // 这意味着在 requireMention=true 时，消息会被跳过
  return false;
}

// ============================================================================
// 多账户支持函数 (Multi-Account Support Functions)
// ============================================================================

/**
 * 获取所有配置的账户 ID 列表
 */
function listWecomAccountIds(cfg: ClawdbotConfig): string[] {
  const channelConfig = cfg.channels?.wecom as WecomChannelConfig | undefined;
  const accounts = channelConfig?.accounts;

  // 如果有 accounts 配置，返回所有账户 ID
  if (accounts && typeof accounts === "object") {
    const ids = Object.keys(accounts).filter(Boolean);
    if (ids.length > 0) {
      return ids.sort((a, b) => a.localeCompare(b));
    }
  }

  // 否则返回默认账户
  return [DEFAULT_ACCOUNT_ID];
}

/**
 * 获取默认账户 ID
 */
function getDefaultWecomAccountId(cfg: ClawdbotConfig): string {
  const channelConfig = cfg.channels?.wecom as WecomChannelConfig | undefined;

  // 优先使用配置的 defaultAccount
  if (channelConfig?.defaultAccount?.trim()) {
    return channelConfig.defaultAccount.trim();
  }

  // 否则使用第一个账户或 default
  const ids = listWecomAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) {
    return DEFAULT_ACCOUNT_ID;
  }
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

/**
 * 合并账户配置 (账户特定配置覆盖基础配置)
 */
function mergeAccountConfig(
  baseConfig: WecomChannelConfig,
  accountConfig: WecomAccountConfig | undefined,
): WecomChannelConfig {
  // 从基础配置中提取，排除 accounts 和 defaultAccount
  const { accounts: _accounts, defaultAccount: _defaultAccount, ...baseFields } = baseConfig;

  // 合并账户特定配置
  return {
    ...baseFields,
    ...(accountConfig ?? {}),
    // 如果账户有自己的 app 配置，使用账户的；否则使用基础的
    app: accountConfig?.app ?? baseConfig.app,
    // 群聊配置合并
    groups: {
      ...(baseConfig.groups ?? {}),
      ...(accountConfig?.groups ?? {}),
    },
  };
}

/**
 * 解析企业微信账户配置 (支持多账户)
 */
function resolveWecomAccount(params: {
  cfg: ClawdbotConfig;
  accountId?: string | null;
}): ResolvedWecomAccount {
  const { cfg, accountId } = params;
  const resolvedAccountId = accountId ?? DEFAULT_ACCOUNT_ID;
  const channelConfig = cfg.channels?.wecom as WecomChannelConfig | undefined;

  // 检查是否是多账户模式
  const hasAccounts = channelConfig?.accounts && Object.keys(channelConfig.accounts).length > 0;
  const accountSpecificConfig = hasAccounts ? channelConfig?.accounts?.[resolvedAccountId] : undefined;

  // 合并配置: 账户特定配置 > 基础配置
  const mergedConfig = accountSpecificConfig
    ? mergeAccountConfig(channelConfig ?? {}, accountSpecificConfig)
    : (channelConfig ?? {});

  // 解析凭证
  const corpId = mergedConfig.app?.corpId ?? null;
  const agentId = mergedConfig.app?.agentId ?? null;
  const agentSecret = mergedConfig.app?.agentSecret ?? null;

  // 基础启用状态
  const baseEnabled = channelConfig?.enabled !== false;
  // 账户特定启用状态
  const accountEnabled = accountSpecificConfig?.enabled !== false;

  return {
    accountId: resolvedAccountId,
    enabled: baseEnabled && accountEnabled,
    configured: Boolean(corpId && agentId && agentSecret),
    corpId,
    agentId,
    agentSecret,
    config: mergedConfig,
  };
}

/**
 * 解析企业微信应用凭证 (用于特定账户)
 */
function resolveWecomCredentials(
  config?: WecomChannelConfig,
  accountId?: string,
): {
  corpId: string | null;
  agentId: number | null;
  agentSecret: string | null;
} {
  // 如果指定了账户 ID 且存在账户配置，使用账户的凭证
  if (accountId && config?.accounts?.[accountId]?.app) {
    const accountApp = config.accounts[accountId].app;
    return {
      corpId: accountApp?.corpId ?? null,
      agentId: accountApp?.agentId ?? null,
      agentSecret: accountApp?.agentSecret ?? null,
    };
  }

  // 否则使用基础配置
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
    aliases: [...meta.aliases],
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
    chatTypes: ["direct", "group"],
    media: false, // 企业微信应用消息暂不支持富媒体
  },
  reload: { configPrefixes: ["channels.wecom"] },
  configSchema: buildChannelConfigSchema(WecomConfigSchema),
  config: {
    listAccountIds: (cfg) => listWecomAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveWecomAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => getDefaultWecomAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }) => {
      const channelConfig = cfg.channels?.wecom as WecomChannelConfig | undefined;
      const resolvedAccountId = accountId ?? DEFAULT_ACCOUNT_ID;

      // 检查是否是多账户模式且目标是特定账户
      const hasAccounts = channelConfig?.accounts && Object.keys(channelConfig.accounts).length > 0;
      const isSpecificAccount = hasAccounts && resolvedAccountId !== DEFAULT_ACCOUNT_ID;

      if (isSpecificAccount && channelConfig?.accounts?.[resolvedAccountId]) {
        // 多账户模式: 更新特定账户的 enabled
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
                  enabled,
                },
              },
            },
          },
        };
      }

      // 单账户模式或默认账户: 更新顶层 enabled
      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          wecom: {
            ...(channelConfig ?? {}),
            enabled,
          },
        },
      };
    },
    deleteAccount: ({ cfg, accountId }) => {
      const channelConfig = cfg.channels?.wecom as WecomChannelConfig | undefined;
      const resolvedAccountId = accountId ?? DEFAULT_ACCOUNT_ID;

      // 如果删除的是特定账户 (非 default)
      if (resolvedAccountId !== DEFAULT_ACCOUNT_ID && channelConfig?.accounts?.[resolvedAccountId]) {
        const { [resolvedAccountId]: _deleted, ...remainingAccounts } = channelConfig.accounts;
        return {
          ...cfg,
          channels: {
            ...cfg.channels,
            wecom: {
              ...channelConfig,
              accounts: Object.keys(remainingAccounts).length > 0 ? remainingAccounts : undefined,
            },
          },
        };
      }

      // 删除整个渠道配置
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
    isConfigured: (account, cfg) => {
      const channelConfig = cfg.channels?.wecom as WecomChannelConfig;
      const { corpId, agentId, agentSecret } = resolveWecomCredentials(channelConfig, account.accountId);
      return Boolean(corpId && agentId && agentSecret);
    },
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      name: (account.config as WecomChannelConfig & { name?: string })?.name,
      webhookPath: account.config?.webhookPath,
    }),
    resolveAllowFrom: ({ cfg, accountId }) => {
      const account = resolveWecomAccount({ cfg, accountId });
      return account.config?.allowFrom ?? [];
    },
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.toLowerCase()),
  },
  groups: {
    resolveRequireMention: ({ cfg }) => {
      const channelConfig = cfg.channels?.wecom as WecomChannelConfig | undefined;
      return channelConfig?.requireMention !== false; // 默认 true
    },
  },
  security: {
    collectWarnings: ({ cfg }) => {
      const channelConfig = cfg.channels?.wecom as WecomChannelConfig | undefined;
      if (!channelConfig || channelConfig.enabled === false) return [];

      const dmPolicy = channelConfig.dmPolicy ?? "allowlist";
      const groupPolicy = channelConfig.groupPolicy ?? "allowlist";
      const warnings: string[] = [];

      // 签名验证缺失警告
      const token = channelConfig.app?.token?.trim();
      const encodingAESKey = channelConfig.app?.encodingAESKey?.trim();
      if (!token || !encodingAESKey) {
        warnings.push(
          `- 企业微信: 未配置 token 或 encodingAESKey，Webhook 回调无法解密消息。请在企业微信管理后台获取回调 Token 和 EncodingAESKey 并设置 channels.wecom.app.token / channels.wecom.app.encodingAESKey。`,
        );
      }

      if (dmPolicy === "open") {
        warnings.push(
          `- 企业微信: dmPolicy="open" 允许任何企业成员发送消息。建议设置 channels.wecom.dmPolicy="allowlist" + channels.wecom.allowFrom 来限制。`,
        );
      }

      if (groupPolicy === "open") {
        warnings.push(
          `- 企业微信群聊: groupPolicy="open" 允许任何群成员触发 (@机器人才响应)。建议设置 channels.wecom.groupPolicy="allowlist" + channels.wecom.groupAllowFrom 来限制。`,
        );
      }

      return warnings;
    },
  },
  messaging: {
    normalizeTarget: (raw) => {
      const trimmed = raw.trim();
      if (!trimmed) return undefined;
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
    listGroups: async ({ cfg, query, limit }) => {
      // 从 groupAllowFrom 和 groups 配置中获取群列表
      const channelConfig = cfg.channels?.wecom as WecomChannelConfig | undefined;
      const q = query?.trim().toLowerCase() || "";
      const ids = new Set<string>();

      // 从 groupAllowFrom 获取群 ID
      for (const entry of channelConfig?.groupAllowFrom ?? []) {
        const trimmed = String(entry).trim();
        if (trimmed && trimmed !== "*") ids.add(trimmed);
      }

      // 从 groups 配置获取群 ID
      for (const groupId of Object.keys(channelConfig?.groups ?? {})) {
        const trimmed = groupId.trim();
        if (trimmed) ids.add(trimmed);
      }

      return Array.from(ids)
        .filter((id) => (q ? id.toLowerCase().includes(q) : true))
        .slice(0, limit && limit > 0 ? limit : undefined)
        .map((id) => ({ kind: "group", id }) as const);
    },
  },
  outbound: {
    deliveryMode: "direct",
    chunker: (text, limit) => getWecomRuntime().channel.text.chunkMarkdownText(text, limit),
    chunkerMode: "markdown",
    textChunkLimit: 680, // 企业微信文本消息限制 2048 字节，CJK 每字符 3 字节，保守取 floor(2048/3)=682
    sendText: async ({ to, text, cfg }) => {
      const channelConfig = cfg.channels?.wecom as WecomChannelConfig;
      const result = await sendWecomMessage(channelConfig, to, text, {
        msgType: "text",
      });
      return { channel: WECOM_CHANNEL_ID, messageId: result.msgid ?? "", ...result };
    },
    sendMedia: async ({ to, text, cfg }) => {
      // 暂时用文本消息代替
      const channelConfig = cfg.channels?.wecom as WecomChannelConfig;
      const result = await sendWecomMessage(channelConfig, to, text);
      return { channel: WECOM_CHANNEL_ID, messageId: result.msgid ?? "", ...result };
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
          ctx.log?.info(`[wecom] 收到消息: from=${msg.userId}, type=${msg.msgType}, chatType=${msg.chatType}, chatId=${msg.chatId ?? "N/A"}`);

          // ========================================
          // DM 策略检查 (P0-4 修复)
          // ========================================
          if (msg.chatType === "direct") {
            const dmPolicy = channelConfig?.dmPolicy ?? "allowlist";
            const allowFrom = channelConfig?.allowFrom ?? [];

            if (dmPolicy === "allowlist") {
              const isAllowed = allowFrom.includes("*") || allowFrom.includes(msg.userId);
              if (!isAllowed) {
                ctx.log?.info(`[wecom] 用户 ${msg.userId} 不在 DM 白名单中 (dmPolicy=allowlist)，跳过`);
                return;
              }
            }
            // dmPolicy === "open" 不检查
            // dmPolicy === "pairing" 由框架 pairing 机制处理
          }

          // ========================================
          // 群聊策略检查
          // ========================================
          if (msg.chatType === "group") {
            const groupPolicy = channelConfig?.groupPolicy ?? "allowlist";
            const groupAllowFrom = channelConfig?.groupAllowFrom ?? [];
            const requireMention = channelConfig?.requireMention !== false; // 默认 true

            // 群聊策略: disabled = 禁用群聊
            if (groupPolicy === "disabled") {
              ctx.log?.info(`[wecom] 群聊策略为 disabled，跳过消息处理`);
              return;
            }

            // 群聊策略: allowlist = 白名单
            if (groupPolicy === "allowlist" && msg.chatId) {
              const isAllowed = groupAllowFrom.includes("*") || groupAllowFrom.includes(msg.chatId);
              if (!isAllowed) {
                ctx.log?.info(`[wecom] 群 ${msg.chatId} 不在白名单中，跳过消息处理`);
                return;
              }
            }

            // 检查是否需要 @机器人
            if (requireMention) {
              // 企业微信群聊中，检查消息是否包含 @机器人
              // 注意: 企业微信的 @机器人 检测需要根据实际消息格式来判断
              // 通常消息中会包含 @机器人名称 或者通过特殊字段标识
              // 这里暂时通过检查消息是否以 @ 开头或包含机器人相关标识来判断
              // 实际场景中可能需要根据企业微信的具体回调格式调整
              const botMentioned = checkBotMentioned(msg.text, channelConfig);
              if (!botMentioned) {
                ctx.log?.info(`[wecom] 群聊消息未 @机器人 (requireMention=true)，跳过`);
                return;
              }
            }

            // 群聊特定配置检查 (按群 ID 配置)
            const groupConfig = msg.chatId ? channelConfig?.groups?.[msg.chatId] : undefined;
            if (groupConfig) {
              // 群聊特定的发送者白名单检查
              if (groupConfig.allowFrom && groupConfig.allowFrom.length > 0) {
                const isUserAllowed = groupConfig.allowFrom.includes("*") || groupConfig.allowFrom.includes(msg.userId);
                if (!isUserAllowed) {
                  ctx.log?.info(`[wecom] 用户 ${msg.userId} 不在群 ${msg.chatId} 的 allowFrom 中，跳过`);
                  return;
                }
              }
            }
          }

          // ========================================
          // 构建入站消息上下文
          // ========================================
          const chatTypeLabel = msg.chatType === "group" ? "group" : "direct";
          const fromLabel = msg.chatType === "group"
            ? `wecom:group:${msg.chatId}:${msg.userId}`
            : `wecom:${msg.userId}`;
          const toLabel = msg.chatType === "group"
            ? `wecom:group:${msg.chatId}`
            : `wecom:${msg.userId}`;

          const inboundCtx = {
            Channel: WECOM_CHANNEL_ID,
            AccountId: ctx.accountId,
            MessageId: msg.msgId,
            From: fromLabel,
            SenderId: msg.userId,
            SenderName: msg.userId, // 企业微信回调不包含用户名，用 userId 代替
            Body: msg.text,
            RawBody: msg.text,
            ChatType: chatTypeLabel as "direct" | "group",
            ChatId: msg.chatId,
            To: toLabel,
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
                    if (msg.chatType === "group" && msg.chatId) {
                      // 群聊回复: 使用 /appchat/send 接口发送到群聊
                      try {
                        await sendWecomGroupMessage(channelConfig, msg.chatId, text);
                        ctx.log?.info(`[wecom] 已回复群聊消息到 chatId=${msg.chatId}`);
                      } catch (groupErr) {
                        // 群聊 API 可能因权限等原因失败，降级为发送给用户
                        ctx.log?.warn(`[wecom] 群聊回复失败 (${groupErr})，降级为私聊回复用户 ${msg.userId}`);
                        await sendWecomMessage(channelConfig, msg.userId, text);
                      }
                    } else {
                      // 私聊回复: 回复到用户
                      await sendWecomMessage(channelConfig, msg.userId, text);
                      ctx.log?.info(`[wecom] 已回复私聊消息到 ${msg.userId}`);
                    }
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
