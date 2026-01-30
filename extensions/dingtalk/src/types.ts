/**
 * 钉钉渠道类型定义
 * DingTalk Channel Type Definitions
 */

// ============================================================================
// 配置类型 (Configuration Types)
// ============================================================================

/**
 * 钉钉应用配置
 */
export interface DingtalkAppConfig {
  /** 应用 AppKey */
  appKey: string;
  /** 应用 AppSecret */
  appSecret: string;
  /** 机器人 RobotCode (可选，用于机器人消息) */
  robotCode?: string;
  /** 消息加签密钥 (可选，用于安全验证) */
  signSecret?: string;
}

/**
 * 钉钉渠道配置
 */
export interface DingtalkChannelConfig {
  /** 是否启用 */
  enabled?: boolean;
  /** 应用配置 */
  app?: DingtalkAppConfig;
  /** Webhook 端口 (默认 3002) */
  webhookPort?: number;
  /** Webhook 路径 (默认 /dingtalk/webhook) */
  webhookPath?: string;
  /** 允许的用户 ID 列表 */
  allowFrom?: string[];
  /** 私聊策略: "open" | "allowlist" | "pairing" */
  dmPolicy?: "open" | "allowlist" | "pairing";
  /** 群聊策略: "open" | "allowlist" */
  groupPolicy?: "open" | "allowlist";
  /** 群聊配置 */
  groups?: Record<string, DingtalkGroupConfig>;
}

/**
 * 钉钉群聊配置
 */
export interface DingtalkGroupConfig {
  /** 是否需要 @机器人 才响应 */
  requireMention?: boolean;
  /** 允许的发送者 */
  allowFrom?: string[];
}

// ============================================================================
// API 响应类型 (API Response Types)
// ============================================================================

/**
 * 钉钉 Access Token 响应
 */
export interface DingtalkTokenResponse {
  errcode: number;
  errmsg: string;
  access_token?: string;
  expires_in?: number;
}

/**
 * 钉钉发送消息响应
 */
export interface DingtalkSendMessageResponse {
  errcode: number;
  errmsg: string;
  task_id?: string;
  request_id?: string;
}

/**
 * 钉钉机器人发送消息响应
 */
export interface DingtalkRobotSendResponse {
  processQueryKey?: string;
}

// ============================================================================
// 事件类型 (Event Types)
// ============================================================================

/**
 * 钉钉回调事件基础结构
 */
export interface DingtalkCallbackBase {
  /** 加密后的消息体 */
  encrypt?: string;
  /** 消息签名 */
  msg_signature?: string;
  /** 时间戳 */
  timestamp?: string;
  /** 随机字符串 */
  nonce?: string;
}

/**
 * 钉钉消息接收事件 (机器人)
 */
export interface DingtalkRobotMessageEvent {
  /** 消息 ID */
  msgId: string;
  /** 消息类型: text, richText, picture, audio, video, file */
  msgtype: string;
  /** 会话 ID */
  conversationId: string;
  /** 会话类型: 1=单聊, 2=群聊 */
  conversationType: "1" | "2";
  /** 会话标题 (群聊时为群名) */
  conversationTitle?: string;
  /** 发送者信息 */
  senderId: string;
  senderNick: string;
  senderCorpId?: string;
  senderStaffId?: string;
  /** @我的用户列表 */
  atUsers?: Array<{
    dingtalkId: string;
    staffId?: string;
  }>;
  /** 是否 @了我 */
  isAtMe?: boolean;
  /** 是否在 @列表中 */
  isInAtList?: boolean;
  /** 发送时间 */
  createAt: number;
  /** 消息内容 */
  text?: {
    content: string;
  };
  /** 富文本内容 */
  richText?: {
    richTextList: Array<{
      type: "text" | "picture";
      text?: string;
      pictureDownloadCode?: string;
      downloadCode?: string;
    }>;
  };
  /** 图片内容 */
  picture?: {
    downloadCode: string;
  };
  /** 语音内容 */
  audio?: {
    downloadCode: string;
    duration?: number;
  };
  /** 视频内容 */
  video?: {
    downloadCode: string;
    duration?: number;
  };
  /** 文件内容 */
  file?: {
    downloadCode: string;
    fileName: string;
    fileSize?: number;
  };
  /** 机器人 Code */
  robotCode?: string;
  /** Session Webhook (用于回复) */
  sessionWebhook?: string;
  /** Session Webhook 过期时间 */
  sessionWebhookExpiredTime?: number;
}

// ============================================================================
// 消息内容类型 (Message Content Types)
// ============================================================================

/**
 * 钉钉文本消息
 */
export interface DingtalkTextMessage {
  msgtype: "text";
  text: {
    content: string;
  };
}

/**
 * 钉钉 Markdown 消息
 */
export interface DingtalkMarkdownMessage {
  msgtype: "markdown";
  markdown: {
    title: string;
    text: string;
  };
}

/**
 * 钉钉链接消息
 */
export interface DingtalkLinkMessage {
  msgtype: "link";
  link: {
    title: string;
    text: string;
    messageUrl: string;
    picUrl?: string;
  };
}

/**
 * 钉钉 ActionCard 消息
 */
export interface DingtalkActionCardMessage {
  msgtype: "actionCard";
  actionCard: {
    title: string;
    text: string;
    singleTitle?: string;
    singleURL?: string;
    btnOrientation?: "0" | "1";
    btns?: Array<{
      title: string;
      actionURL: string;
    }>;
  };
}

/**
 * 钉钉 FeedCard 消息
 */
export interface DingtalkFeedCardMessage {
  msgtype: "feedCard";
  feedCard: {
    links: Array<{
      title: string;
      messageURL: string;
      picURL?: string;
    }>;
  };
}

/**
 * 钉钉消息类型联合
 */
export type DingtalkMessage =
  | DingtalkTextMessage
  | DingtalkMarkdownMessage
  | DingtalkLinkMessage
  | DingtalkActionCardMessage
  | DingtalkFeedCardMessage;

// ============================================================================
// 解析后的账户类型 (Resolved Account Type)
// ============================================================================

/**
 * 解析后的钉钉账户
 */
export interface ResolvedDingtalkAccount {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  appKey: string | null;
  appSecret: string | null;
  robotCode: string | null;
  config: DingtalkChannelConfig;
}

// ============================================================================
// 探测结果类型 (Probe Result Type)
// ============================================================================

/**
 * 钉钉连接探测结果
 */
export interface DingtalkProbeResult {
  ok: boolean;
  error?: string;
  appKey?: string;
  robotCode?: string;
  elapsedMs?: number;
}
