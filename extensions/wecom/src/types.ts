/**
 * 企业微信渠道类型定义
 * WeCom (WeChat Work) Channel Type Definitions
 *
 * 文档参考:
 * - 企业微信开放平台: https://developer.work.weixin.qq.com/
 * - 应用消息: https://developer.work.weixin.qq.com/document/path/90236
 * - 回调通知: https://developer.work.weixin.qq.com/document/path/90930
 */

// ============================================================================
// 配置类型 (Configuration Types)
// ============================================================================

/**
 * 企业微信应用配置
 */
export interface WecomAppConfig {
  /** 企业 ID (CorpID) */
  corpId: string;
  /** 应用 Secret (AgentSecret) */
  agentSecret: string;
  /** 应用 AgentId */
  agentId: number;
  /** 回调 Token (用于验证回调请求) */
  token?: string;
  /** 回调 EncodingAESKey (用于加解密) */
  encodingAESKey?: string;
}

/**
 * 企业微信渠道配置
 */
export interface WecomChannelConfig {
  /** 是否启用 */
  enabled?: boolean;
  /** 应用配置 */
  app?: WecomAppConfig;
  /** Webhook 端口 (默认 3003) */
  webhookPort?: number;
  /** Webhook 路径 (默认 /wecom/webhook) */
  webhookPath?: string;
  /** 允许的用户 ID 列表 */
  allowFrom?: string[];
  /** 私聊策略: "open" | "allowlist" | "pairing" */
  dmPolicy?: "open" | "allowlist" | "pairing";
  /** 群聊策略: "open" | "allowlist" */
  groupPolicy?: "open" | "allowlist";
  /** 群聊配置 */
  groups?: Record<string, WecomGroupConfig>;
}

/**
 * 企业微信群聊配置
 */
export interface WecomGroupConfig {
  /** 是否需要 @机器人 才响应 */
  requireMention?: boolean;
  /** 允许的发送者 */
  allowFrom?: string[];
}

// ============================================================================
// API 响应类型 (API Response Types)
// ============================================================================

/**
 * 企业微信 Access Token 响应
 */
export interface WecomTokenResponse {
  errcode: number;
  errmsg: string;
  access_token?: string;
  expires_in?: number;
}

/**
 * 企业微信发送消息响应
 */
export interface WecomSendMessageResponse {
  errcode: number;
  errmsg: string;
  invaliduser?: string;
  invalidparty?: string;
  invalidtag?: string;
  unlicenseduser?: string;
  msgid?: string;
  response_code?: string;
}

// ============================================================================
// 事件类型 (Event Types)
// ============================================================================

/**
 * 企业微信回调消息基础结构 (加密前)
 */
export interface WecomCallbackEncrypted {
  /** 消息签名 */
  msg_signature: string;
  /** 时间戳 */
  timestamp: string;
  /** 随机字符串 */
  nonce: string;
  /** 加密的消息体 (POST body 中的 Encrypt 字段) */
  echostr?: string; // URL 验证时使用
}

/**
 * 企业微信文本消息事件
 */
export interface WecomTextMessageEvent {
  /** 消息类型: text */
  MsgType: "text";
  /** 消息 ID */
  MsgId: string;
  /** 企业 ID */
  ToUserName: string;
  /** 发送者 UserId */
  FromUserName: string;
  /** 创建时间 (Unix 时间戳) */
  CreateTime: number;
  /** 消息内容 */
  Content: string;
  /** 应用 ID */
  AgentID: number;
}

/**
 * 企业微信图片消息事件
 */
export interface WecomImageMessageEvent {
  MsgType: "image";
  MsgId: string;
  ToUserName: string;
  FromUserName: string;
  CreateTime: number;
  PicUrl: string;
  MediaId: string;
  AgentID: number;
}

/**
 * 企业微信语音消息事件
 */
export interface WecomVoiceMessageEvent {
  MsgType: "voice";
  MsgId: string;
  ToUserName: string;
  FromUserName: string;
  CreateTime: number;
  MediaId: string;
  Format: string;
  AgentID: number;
}

/**
 * 企业微信视频消息事件
 */
export interface WecomVideoMessageEvent {
  MsgType: "video";
  MsgId: string;
  ToUserName: string;
  FromUserName: string;
  CreateTime: number;
  MediaId: string;
  ThumbMediaId: string;
  AgentID: number;
}

/**
 * 企业微信位置消息事件
 */
export interface WecomLocationMessageEvent {
  MsgType: "location";
  MsgId: string;
  ToUserName: string;
  FromUserName: string;
  CreateTime: number;
  Location_X: number;
  Location_Y: number;
  Scale: number;
  Label: string;
  AgentID: number;
}

/**
 * 企业微信链接消息事件
 */
export interface WecomLinkMessageEvent {
  MsgType: "link";
  MsgId: string;
  ToUserName: string;
  FromUserName: string;
  CreateTime: number;
  Title: string;
  Description: string;
  Url: string;
  PicUrl: string;
  AgentID: number;
}

/**
 * 企业微信事件消息 (关注/取消关注等)
 */
export interface WecomEventMessage {
  MsgType: "event";
  ToUserName: string;
  FromUserName: string;
  CreateTime: number;
  AgentID: number;
  Event: "subscribe" | "unsubscribe" | "enter_agent" | "click" | "view" | "scancode_push" | "location_select";
  EventKey?: string;
}

/**
 * 企业微信消息事件联合类型
 */
export type WecomMessageEvent =
  | WecomTextMessageEvent
  | WecomImageMessageEvent
  | WecomVoiceMessageEvent
  | WecomVideoMessageEvent
  | WecomLocationMessageEvent
  | WecomLinkMessageEvent
  | WecomEventMessage;

// ============================================================================
// 消息内容类型 (Message Content Types)
// ============================================================================

/**
 * 企业微信文本消息
 */
export interface WecomTextMessage {
  msgtype: "text";
  agentid: number;
  touser?: string;
  toparty?: string;
  totag?: string;
  text: {
    content: string;
  };
  safe?: 0 | 1;
  enable_id_trans?: 0 | 1;
  enable_duplicate_check?: 0 | 1;
  duplicate_check_interval?: number;
}

/**
 * 企业微信 Markdown 消息
 */
export interface WecomMarkdownMessage {
  msgtype: "markdown";
  agentid: number;
  touser?: string;
  toparty?: string;
  totag?: string;
  markdown: {
    content: string;
  };
  enable_duplicate_check?: 0 | 1;
  duplicate_check_interval?: number;
}

/**
 * 企业微信图片消息
 */
export interface WecomImageMessage {
  msgtype: "image";
  agentid: number;
  touser?: string;
  toparty?: string;
  totag?: string;
  image: {
    media_id: string;
  };
  safe?: 0 | 1;
  enable_duplicate_check?: 0 | 1;
  duplicate_check_interval?: number;
}

/**
 * 企业微信图文消息
 */
export interface WecomNewsMessage {
  msgtype: "news";
  agentid: number;
  touser?: string;
  toparty?: string;
  totag?: string;
  news: {
    articles: Array<{
      title: string;
      description?: string;
      url: string;
      picurl?: string;
      appid?: string;
      pagepath?: string;
    }>;
  };
  enable_id_trans?: 0 | 1;
  enable_duplicate_check?: 0 | 1;
  duplicate_check_interval?: number;
}

/**
 * 企业微信文本卡片消息
 */
export interface WecomTextCardMessage {
  msgtype: "textcard";
  agentid: number;
  touser?: string;
  toparty?: string;
  totag?: string;
  textcard: {
    title: string;
    description: string;
    url: string;
    btntxt?: string;
  };
  enable_id_trans?: 0 | 1;
  enable_duplicate_check?: 0 | 1;
  duplicate_check_interval?: number;
}

/**
 * 企业微信模板卡片消息
 */
export interface WecomTemplateCardMessage {
  msgtype: "template_card";
  agentid: number;
  touser?: string;
  toparty?: string;
  totag?: string;
  template_card: {
    card_type: "text_notice" | "news_notice" | "button_interaction" | "vote_interaction" | "multiple_interaction";
    source?: {
      icon_url?: string;
      desc?: string;
      desc_color?: number;
    };
    main_title?: {
      title?: string;
      desc?: string;
    };
    emphasis_content?: {
      title?: string;
      desc?: string;
    };
    sub_title_text?: string;
    horizontal_content_list?: Array<{
      keyname: string;
      value?: string;
      type?: 0 | 1 | 2 | 3;
      url?: string;
      media_id?: string;
      userid?: string;
    }>;
    jump_list?: Array<{
      type: 0 | 1;
      title: string;
      url?: string;
      appid?: string;
      pagepath?: string;
    }>;
    card_action?: {
      type: 1 | 2;
      url?: string;
      appid?: string;
      pagepath?: string;
    };
  };
  enable_id_trans?: 0 | 1;
  enable_duplicate_check?: 0 | 1;
  duplicate_check_interval?: number;
}

/**
 * 企业微信消息类型联合
 */
export type WecomMessage =
  | WecomTextMessage
  | WecomMarkdownMessage
  | WecomImageMessage
  | WecomNewsMessage
  | WecomTextCardMessage
  | WecomTemplateCardMessage;

// ============================================================================
// 解析后的账户类型 (Resolved Account Type)
// ============================================================================

/**
 * 解析后的企业微信账户
 */
export interface ResolvedWecomAccount {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  corpId: string | null;
  agentId: number | null;
  agentSecret: string | null;
  config: WecomChannelConfig;
}

// ============================================================================
// 探测结果类型 (Probe Result Type)
// ============================================================================

/**
 * 企业微信连接探测结果
 */
export interface WecomProbeResult {
  ok: boolean;
  error?: string;
  corpId?: string;
  agentId?: number;
  elapsedMs?: number;
}
