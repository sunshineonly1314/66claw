/**
 * 飞书渠道类型定义
 * Feishu Channel Type Definitions
 *
 * 融合自 m1heng/clawdbot-feishu 的增强功能
 */

import type { FeishuConfigSchemaType, FeishuGroupSchemaType } from "./config-schema.js";

// ============================================================================
// 基础类型
// ============================================================================

/** 飞书域名类型 */
export type FeishuDomain = "feishu" | "lark";

/** 连接模式 */
export type FeishuConnectionMode = "websocket" | "webhook";

/** 渲染模式 */
export type FeishuRenderMode = "auto" | "raw" | "card";

/** ID 类型 */
export type FeishuIdType = "open_id" | "user_id" | "union_id" | "chat_id";

// ============================================================================
// 配置类型 (Configuration Types)
// ============================================================================

/**
 * 飞书渠道配置
 */
export interface FeishuChannelConfig {
  /** 是否启用 */
  enabled?: boolean;

  // 应用凭证
  appId?: string;
  appSecret?: string;
  encryptKey?: string;
  verificationToken?: string;

  // 旧版嵌套配置 (运行时兼容，UI 不再渲染)
  app?: {
    appId?: string;
    appSecret?: string;
    encryptKey?: string;
    verificationToken?: string;
  };

  // 连接配置
  domain?: FeishuDomain;
  connectionMode?: FeishuConnectionMode;
  webhookPort?: number;
  webhookPath?: string;

  // 私聊配置
  dmPolicy?: "open" | "allowlist" | "pairing";
  allowFrom?: (string | number)[];
  dmHistoryLimit?: number;

  // 群聊配置
  groupPolicy?: "open" | "allowlist" | "disabled";
  groupAllowFrom?: (string | number)[];
  requireMention?: boolean;
  groups?: Record<string, FeishuGroupConfig>;
  historyLimit?: number;

  // 消息配置
  renderMode?: FeishuRenderMode;
  textChunkLimit?: number;
  chunkMode?: "length" | "newline";
  markdown?: {
    mode?: "native" | "escape" | "strip";
    tableMode?: "native" | "ascii" | "simple";
  };

  // 媒体配置
  mediaMaxMb?: number;

  // 高级配置 (流式卡片、多机器人安全、工具开关)
  advanced?: FeishuAdvancedConfig;
}

/**
 * 飞书群聊配置
 */
export interface FeishuGroupConfig {
  /** 是否需要 @机器人 才响应 */
  requireMention?: boolean;
  /** 允许的发送者 */
  allowFrom?: (string | number)[];
  /** 是否启用 */
  enabled?: boolean;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 工具策略配置 */
  tools?: Record<string, unknown>;
}

/**
 * 飞书工具配置
 */
export interface FeishuToolsConfig {
  doc?: boolean;
  wiki?: boolean;
  drive?: boolean;
  perm?: boolean;
  scopes?: boolean;
  task?: boolean;
  calendar?: boolean;
}

/**
 * 飞书高级配置
 * UI 中渲染为可折叠的高级选项区域
 */
export interface FeishuAdvancedConfig {
  /** 是否启用流式卡片渲染 (默认 false，需要 cardkit:card 权限) */
  streaming?: boolean;
  /** 多机器人群中是否允许不 @本机器人就响应 (默认 false) */
  allowMentionlessInMultiBotGroup?: boolean;
  /** 工具功能开关 */
  tools?: FeishuToolsConfig;
}

// ============================================================================
// API 响应类型 (API Response Types)
// ============================================================================

/**
 * 飞书 Access Token 响应
 */
export interface FeishuTokenResponse {
  code: number;
  msg: string;
  tenant_access_token?: string;
  expire?: number;
}

/**
 * 飞书发送消息响应
 */
export interface FeishuSendMessageResponse {
  code: number;
  msg: string;
  data?: {
    message_id: string;
    root_id?: string;
    parent_id?: string;
    thread_id?: string;
    msg_type: string;
    create_time: string;
    update_time: string;
    deleted: boolean;
    chat_id: string;
    sender: {
      id: string;
      id_type: string;
      sender_type: string;
      tenant_key?: string;
    };
    body: {
      content: string;
    };
  };
}

/**
 * 发送结果
 */
export interface FeishuSendResult {
  messageId: string;
  chatId: string;
}

// ============================================================================
// 消息上下文类型
// ============================================================================

/**
 * @ 提及目标
 */
export interface MentionTarget {
  openId: string;
  name: string;
  key: string; // 消息中的占位符，如 @_user_1
}

/**
 * 飞书消息上下文
 */
export interface FeishuMessageContext {
  chatId: string;
  messageId: string;
  senderId: string;
  senderOpenId: string;
  senderName?: string;
  chatType: "p2p" | "group";
  mentionedBot: boolean;
  rootId?: string;
  parentId?: string;
  content: string;
  contentType: string;
  /** @ 转发目标 (不包括机器人本身) */
  mentionTargets?: MentionTarget[];
  /** 提取的消息正文 (移除 @ 占位符后) */
  mentionMessageBody?: string;
}

/**
 * 媒体信息
 */
export interface FeishuMediaInfo {
  path: string;
  contentType?: string;
  placeholder: string;
}

// ============================================================================
// 事件类型 (Event Types)
// ============================================================================

/**
 * 飞书事件消息基础结构
 */
export interface FeishuEventBase {
  schema: string;
  header: {
    event_id: string;
    event_type: string;
    create_time: string;
    token: string;
    app_id: string;
    tenant_key: string;
  };
}

/**
 * 飞书消息接收事件
 */
export interface FeishuMessageReceiveEvent extends FeishuEventBase {
  event: {
    sender: {
      sender_id: {
        union_id?: string;
        user_id?: string;
        open_id?: string;
      };
      sender_type: string;
      tenant_key?: string;
    };
    message: {
      message_id: string;
      root_id?: string;
      parent_id?: string;
      thread_id?: string;
      create_time: string;
      update_time: string;
      chat_id: string;
      chat_type: "p2p" | "group";
      message_type: string;
      content: string;
      mentions?: Array<{
        key: string;
        id: {
          union_id?: string;
          user_id?: string;
          open_id?: string;
        };
        name: string;
        tenant_key?: string;
      }>;
    };
  };
}

/**
 * 飞书 URL 验证事件
 */
export interface FeishuUrlVerificationEvent {
  challenge: string;
  token: string;
  type: "url_verification";
}

// ============================================================================
// 消息内容类型 (Message Content Types)
// ============================================================================

/**
 * 飞书文本消息内容
 */
export interface FeishuTextContent {
  text: string;
}

/**
 * 飞书图片消息内容
 */
export interface FeishuImageContent {
  image_key: string;
}

/**
 * 飞书文件消息内容
 */
export interface FeishuFileContent {
  file_key: string;
  file_name: string;
}

/**
 * 飞书语音消息内容
 */
export interface FeishuAudioContent {
  file_key: string;
  duration?: number;
}

/**
 * 飞书视频消息内容 (message_type: "media")
 */
export interface FeishuMediaContent {
  file_key: string;
  file_name?: string;
  image_key?: string;
}

/**
 * 飞书表情包消息内容
 */
export interface FeishuStickerContent {
  file_key: string;
}

/**
 * 飞书富文本消息内容
 */
export interface FeishuPostContent {
  zh_cn?: {
    title?: string;
    content: Array<Array<FeishuPostElement>>;
  };
  en_us?: {
    title?: string;
    content: Array<Array<FeishuPostElement>>;
  };
}

/**
 * 飞书富文本元素
 */
export type FeishuPostElement =
  | { tag: "text"; text: string; style?: string[] }
  | { tag: "a"; text: string; href: string }
  | { tag: "at"; user_id: string; user_name?: string }
  | { tag: "img"; image_key: string; width?: number; height?: number };

/**
 * 飞书卡片消息内容
 */
export interface FeishuInteractiveContent {
  config?: {
    wide_screen_mode?: boolean;
    enable_forward?: boolean;
  };
  header?: {
    title: {
      tag: "plain_text" | "lark_md";
      content: string;
    };
    template?: string;
  };
  elements: FeishuCardElement[];
}

/**
 * 飞书卡片元素
 */
export type FeishuCardElement =
  | { tag: "div"; text: { tag: "plain_text" | "lark_md"; content: string } }
  | { tag: "markdown"; content: string }
  | { tag: "hr" }
  | { tag: "img"; img_key: string; alt?: { tag: "plain_text"; content: string } }
  | { tag: "action"; actions: FeishuCardAction[] };

/**
 * 飞书卡片动作
 */
export type FeishuCardAction =
  | { tag: "button"; text: { tag: "plain_text"; content: string }; type?: string; value?: Record<string, unknown> }
  | { tag: "select_static"; placeholder?: { tag: "plain_text"; content: string }; options: Array<{ text: { tag: "plain_text"; content: string }; value: string }> };

// ============================================================================
// 解析后的账户类型 (Resolved Account Type)
// ============================================================================

/**
 * 解析后的飞书账户
 */
export interface ResolvedFeishuAccount {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  appId: string | null;
  appSecret: string | null;
  config: FeishuChannelConfig;
  domain: FeishuDomain;
}

/**
 * 解析后的凭证
 */
export interface FeishuCredentials {
  appId: string;
  appSecret: string;
  encryptKey?: string;
  verificationToken?: string;
  domain: FeishuDomain;
}

// ============================================================================
// 探测结果类型 (Probe Result Type)
// ============================================================================

/**
 * 飞书连接探测结果
 */
export interface FeishuProbeResult {
  ok: boolean;
  error?: string;
  appId?: string;
  botName?: string;
  botOpenId?: string;
  elapsedMs?: number;
}

// ============================================================================
// 消息事件类型 (Message Event Types)
// ============================================================================

/**
 * 飞书消息事件 (WebSocket/Webhook 接收)
 */
export interface FeishuMessageEvent {
  sender: {
    sender_id: {
      open_id?: string;
      user_id?: string;
      union_id?: string;
    };
    sender_type?: string;
    tenant_key?: string;
  };
  message: {
    message_id: string;
    root_id?: string;
    parent_id?: string;
    chat_id: string;
    chat_type: "p2p" | "group";
    message_type: string;
    content: string;
    mentions?: Array<{
      key: string;
      id: {
        open_id?: string;
        user_id?: string;
        union_id?: string;
      };
      name: string;
      tenant_key?: string;
    }>;
  };
}

/**
 * 机器人入群事件
 */
export interface FeishuBotAddedEvent {
  chat_id: string;
  operator_id: {
    open_id?: string;
    user_id?: string;
    union_id?: string;
  };
  external: boolean;
  operator_tenant_key?: string;
}
