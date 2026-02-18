/**
 * QQ 机器人渠道类型定义
 * QQ Bot Channel Type Definitions
 *
 * 基于 QQ 开放平台 API v2
 * 文档: https://q.qq.com/wiki/develop/api-v2/
 */

// ============================================================================
// 配置类型 (Configuration Types)
// ============================================================================

/**
 * QQ 机器人应用配置
 */
export interface QqbotAppConfig {
  /** QQ 机器人 AppID */
  appId: string;
  /** QQ 机器人 AppSecret (ClientSecret) */
  appSecret: string;
  /** QQ 机器人 Token (用于验证回调) */
  token?: string;
  /** QQ 机器人公钥 (用于 Ed25519 签名验证，hex 格式) */
  publicKey?: string;
}

/**
 * QQ 机器人渠道配置
 */
export interface QqbotChannelConfig {
  /** 是否启用 */
  enabled?: boolean;
  /** 是否使用沙箱环境 */
  sandbox?: boolean;
  /** 应用配置 */
  app?: QqbotAppConfig;
  /** Webhook 路径 */
  webhookPath?: string;
  /** 允许的用户 ID 列表 */
  allowFrom?: string[];
  /** 私聊策略: "open" | "allowlist" | "pairing" */
  dmPolicy?: "open" | "allowlist" | "pairing";
  /** 群聊策略: "open" | "allowlist" */
  groupPolicy?: "open" | "allowlist";
  /** 群聊配置 */
  groups?: Record<string, QqbotGroupConfig>;
}

/**
 * QQ 机器人群聊配置
 */
export interface QqbotGroupConfig {
  /** 是否需要 @机器人 才响应 */
  requireMention?: boolean;
  /** 允许的发送者 */
  allowFrom?: string[];
}

// ============================================================================
// API 响应类型 (API Response Types)
// ============================================================================

/**
 * QQ 机器人 Access Token 响应
 */
export interface QqbotTokenResponse {
  access_token: string;
  expires_in: number;
}

/**
 * QQ 机器人发送消息响应
 */
export interface QqbotSendMessageResponse {
  id: string;
  timestamp: string;
}

// ============================================================================
// 事件类型 (Event Types)
// ============================================================================

/**
 * QQ 机器人消息事件
 */
export interface QqbotMessageEvent {
  /** 消息 ID */
  id: string;
  /** 消息内容 */
  content: string;
  /** 发送者信息 */
  author: {
    id: string;
    username?: string;
    avatar?: string;
    bot?: boolean;
  };
  /** 频道 ID (频道消息) */
  channel_id?: string;
  /** 子频道 ID */
  guild_id?: string;
  /** 群聊 ID (群聊消息) */
  group_id?: string;
  /** 群聊 openid */
  group_openid?: string;
  /** 消息类型 */
  message_type?: "direct" | "group" | "channel";
  /** 时间戳 */
  timestamp: string;
  /** 消息引用 */
  message_reference?: {
    message_id: string;
  };
  /** @提及的用户 */
  mentions?: Array<{
    id: string;
    username?: string;
  }>;
  /** 附件 */
  attachments?: Array<{
    id: string;
    filename: string;
    content_type?: string;
    size?: number;
    url: string;
  }>;
}

/**
 * QQ 机器人回调事件
 */
export interface QqbotCallbackEvent {
  /** 操作码 */
  op: number;
  /** 数据 */
  d: unknown;
  /** 序列号 */
  s?: number;
  /** 事件类型 */
  t?: string;
}

// ============================================================================
// 消息内容类型 (Message Content Types)
// ============================================================================

/**
 * QQ 机器人文本消息
 */
export interface QqbotTextMessage {
  content: string;
  msg_id?: string;
  msg_type?: number;
}

/**
 * QQ 机器人 Markdown 消息
 */
export interface QqbotMarkdownMessage {
  markdown: {
    content: string;
  };
  msg_id?: string;
  msg_type?: number;
}

/**
 * QQ 机器人媒体消息
 */
export interface QqbotMediaMessage {
  media: {
    file_info: string;
  };
  msg_id?: string;
  msg_type?: number;
}

/**
 * QQ 机器人消息类型联合
 */
export type QqbotMessage =
  | QqbotTextMessage
  | QqbotMarkdownMessage
  | QqbotMediaMessage;

// ============================================================================
// 解析后的账户类型 (Resolved Account Type)
// ============================================================================

/**
 * 解析后的 QQ 机器人账户
 */
export interface ResolvedQqbotAccount {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  appId: string | null;
  appSecret: string | null;
  token: string | null;
  config: QqbotChannelConfig;
}

// ============================================================================
// 探测结果类型 (Probe Result Type)
// ============================================================================

/**
 * QQ 机器人连接探测结果
 */
export interface QqbotProbeResult {
  ok: boolean;
  error?: string;
  appId?: string;
  botInfo?: {
    id: string;
    username?: string;
  };
  elapsedMs?: number;
}

// ============================================================================
// WebSocket 事件类型 (WebSocket Event Types)
// ============================================================================

/**
 * WebSocket 操作码
 */
export const QqbotOpCode = {
  /** 服务端进行消息推送 */
  DISPATCH: 0,
  /** 客户端或服务端发送心跳 */
  HEARTBEAT: 1,
  /** 客户端发送鉴权 */
  IDENTIFY: 2,
  /** 客户端恢复连接 */
  RESUME: 6,
  /** 服务端通知客户端重新连接 */
  RECONNECT: 7,
  /** 当 identify 或 resume 的时候，如果参数有错，服务端会返回该消息 */
  INVALID_SESSION: 9,
  /** 当客户端与网关建立 ws 连接之后，网关下发的第一条消息 */
  HELLO: 10,
  /** 当发送心跳成功之后，就会收到该消息 */
  HEARTBEAT_ACK: 11,
  /** 仅用于 http 回调模式的回包，代表机器人收到了平台推送的数据 */
  HTTP_CALLBACK_ACK: 12,
} as const;

export type QqbotOpCodeType = (typeof QqbotOpCode)[keyof typeof QqbotOpCode];

/**
 * 事件类型
 */
export const QqbotEventType = {
  /** 频道消息 */
  MESSAGE_CREATE: "MESSAGE_CREATE",
  /** 私信消息 */
  DIRECT_MESSAGE_CREATE: "DIRECT_MESSAGE_CREATE",
  /** 群聊消息 */
  GROUP_AT_MESSAGE_CREATE: "GROUP_AT_MESSAGE_CREATE",
  /** C2C 消息 */
  C2C_MESSAGE_CREATE: "C2C_MESSAGE_CREATE",
} as const;

export type QqbotEventTypeValue = (typeof QqbotEventType)[keyof typeof QqbotEventType];
