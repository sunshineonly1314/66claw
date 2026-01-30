/**
 * 飞书渠道类型定义
 * Feishu Channel Type Definitions
 */

// ============================================================================
// 配置类型 (Configuration Types)
// ============================================================================

/**
 * 飞书应用配置
 */
export interface FeishuAppConfig {
  /** 应用 App ID */
  appId: string;
  /** 应用 App Secret */
  appSecret: string;
  /** 事件订阅 Verification Token (可选) */
  verificationToken?: string;
  /** 事件订阅 Encrypt Key (可选，用于加密) */
  encryptKey?: string;
}

/**
 * 飞书渠道配置
 */
export interface FeishuChannelConfig {
  /** 是否启用 */
  enabled?: boolean;
  /** 应用配置 */
  app?: FeishuAppConfig;
  /** Webhook 端口 (默认 3001) */
  webhookPort?: number;
  /** Webhook 路径 (默认 /feishu/webhook) */
  webhookPath?: string;
  /** 允许的用户 ID 列表 */
  allowFrom?: string[];
  /** 私聊策略: "open" | "allowlist" | "pairing" */
  dmPolicy?: "open" | "allowlist" | "pairing";
  /** 群聊策略: "open" | "allowlist" */
  groupPolicy?: "open" | "allowlist";
  /** 群聊配置 */
  groups?: Record<string, FeishuGroupConfig>;
}

/**
 * 飞书群聊配置
 */
export interface FeishuGroupConfig {
  /** 是否需要 @机器人 才响应 */
  requireMention?: boolean;
  /** 允许的发送者 */
  allowFrom?: string[];
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
  elapsedMs?: number;
}
