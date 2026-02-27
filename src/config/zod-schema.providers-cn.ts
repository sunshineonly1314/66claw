/**
 * 中国区渠道配置 Schema (飞书、钉钉、企业微信、QQ 机器人、个人微信)
 * China Region Channel Config Schemas (Feishu, DingTalk, WeCom, QQ Bot, WeChat Personal)
 */

import { z } from "zod";

// ============================================================================
// 飞书 (Feishu/Lark)
// ============================================================================

const FeishuAppSchema = z
  .object({
    appId: z.string().optional().describe("飞书应用 App ID"),
    appSecret: z.string().optional().describe("飞书应用 App Secret"),
    verificationToken: z.string().optional().describe("事件订阅 Verification Token"),
    encryptKey: z.string().optional().describe("事件订阅 Encrypt Key (可选)"),
  })
  .strict();

const FeishuGroupSchema = z
  .object({
    requireMention: z.boolean().optional().describe("是否需要 @机器人 才响应"),
    allowFrom: z.array(z.string()).optional().describe("允许的发送者"),
  })
  .strict();

export const FeishuConfigSchema = z
  .object({
    enabled: z.boolean().optional().default(true).describe("是否启用"),
    app: FeishuAppSchema.optional().describe("应用配置"),
    appId: z.string().optional().describe("飞书应用 App ID (兼容简写)"),
    appSecret: z.string().optional().describe("飞书应用 App Secret (兼容简写)"),
    encryptKey: z.string().optional().describe("事件订阅 Encrypt Key (兼容简写)"),
    verificationToken: z.string().optional().describe("事件订阅 Verification Token (兼容简写)"),
    webhookPath: z.string().optional().default("/feishu/webhook").describe("Webhook 路径"),
    allowFrom: z.array(z.string()).optional().describe("允许的用户 ID 列表"),
    dmPolicy: z
      .enum(["open", "allowlist", "pairing"])
      .optional()
      .default("pairing")
      .describe("私聊策略"),
    groupPolicy: z.enum(["open", "allowlist"]).optional().default("allowlist").describe("群聊策略"),
    groups: z.record(z.string(), FeishuGroupSchema.optional()).optional().describe("群聊配置"),
  })
  .passthrough();

// ============================================================================
// 钉钉 (DingTalk)
// ============================================================================

const DingtalkAppSchema = z
  .object({
    appKey: z.string().optional().describe("钉钉应用 AppKey"),
    appSecret: z.string().optional().describe("钉钉应用 AppSecret"),
    robotCode: z.string().optional().describe("机器人 RobotCode (可选)"),
    signSecret: z.string().optional().describe("消息加签密钥 (可选)"),
  })
  .strict();

const DingtalkGroupSchema = z
  .object({
    requireMention: z.boolean().optional().describe("是否需要 @机器人 才响应"),
    allowFrom: z.array(z.string()).optional().describe("允许的发送者"),
  })
  .strict();

export const DingtalkConfigSchema = z
  .object({
    enabled: z.boolean().optional().default(true).describe("是否启用"),
    app: DingtalkAppSchema.optional().describe("应用配置"),
    appKey: z.string().optional().describe("钉钉应用 AppKey (兼容简写)"),
    appSecret: z.string().optional().describe("钉钉应用 AppSecret (兼容简写)"),
    robotToken: z.string().optional().describe("机器人 Token (兼容简写)"),
    webhookPath: z.string().optional().default("/dingtalk/webhook").describe("Webhook 路径"),
    allowFrom: z.array(z.string()).optional().describe("允许的用户 ID 列表"),
    dmPolicy: z
      .enum(["open", "allowlist", "pairing"])
      .optional()
      .default("pairing")
      .describe("私聊策略"),
    groupPolicy: z.enum(["open", "allowlist"]).optional().default("allowlist").describe("群聊策略"),
    groups: z.record(z.string(), DingtalkGroupSchema.optional()).optional().describe("群聊配置"),
  })
  .passthrough();

// ============================================================================
// 企业微信 (WeCom/WeChat Work)
// ============================================================================

const WecomAppSchema = z
  .object({
    corpId: z.string().optional().describe("企业微信 CorpID"),
    agentId: z.string().optional().describe("应用 AgentID"),
    secret: z.string().optional().describe("应用 Secret"),
    token: z.string().optional().describe("回调 Token"),
    encodingAESKey: z.string().optional().describe("回调 EncodingAESKey"),
  })
  .strict();

const WecomGroupSchema = z
  .object({
    requireMention: z.boolean().optional().describe("是否需要 @机器人 才响应"),
    allowFrom: z.array(z.string()).optional().describe("允许的发送者"),
  })
  .strict();

export const WecomConfigSchema = z
  .object({
    enabled: z.boolean().optional().default(true).describe("是否启用"),
    app: WecomAppSchema.optional().describe("应用配置"),
    corpId: z.string().optional().describe("企业微信 CorpID (兼容简写)"),
    agentId: z.string().optional().describe("应用 AgentID (兼容简写)"),
    secret: z.string().optional().describe("应用 Secret (兼容简写)"),
    token: z.string().optional().describe("回调 Token (兼容简写)"),
    encodingAESKey: z.string().optional().describe("回调 EncodingAESKey (兼容简写)"),
    webhookPath: z.string().optional().default("/wecom/webhook").describe("Webhook 路径"),
    allowFrom: z.array(z.string()).optional().describe("允许的用户 ID 列表"),
    dmPolicy: z
      .enum(["open", "allowlist", "pairing"])
      .optional()
      .default("pairing")
      .describe("私聊策略"),
    groupPolicy: z.enum(["open", "allowlist"]).optional().default("allowlist").describe("群聊策略"),
    groups: z.record(z.string(), WecomGroupSchema.optional()).optional().describe("群聊配置"),
  })
  .passthrough();

// ============================================================================
// QQ 机器人 (QQ Bot)
// ============================================================================

const QqbotAppSchema = z
  .object({
    appId: z.string().optional().describe("QQ 机器人 AppID"),
    appSecret: z.string().optional().describe("QQ 机器人 AppSecret (ClientSecret)"),
    token: z.string().optional().describe("QQ 机器人 Token (用于验证回调)"),
    publicKey: z.string().optional().describe("QQ 机器人公钥 (用于 Ed25519 签名验证，hex 格式)"),
  })
  .strict();

const QqbotGroupSchema = z
  .object({
    requireMention: z.boolean().optional().describe("是否需要 @机器人 才响应"),
    allowFrom: z.array(z.string()).optional().describe("允许的发送者"),
  })
  .strict();

export const QqbotConfigSchema = z
  .object({
    enabled: z.boolean().optional().default(true).describe("是否启用"),
    sandbox: z.boolean().optional().default(false).describe("是否使用沙箱环境"),
    app: QqbotAppSchema.optional().describe("应用配置"),
    appId: z.string().optional().describe("QQ 机器人 AppID (兼容简写)"),
    appSecret: z.string().optional().describe("QQ 机器人 AppSecret (兼容简写)"),
    token: z.string().optional().describe("QQ 机器人 Token (兼容简写)"),
    publicKey: z.string().optional().describe("QQ 机器人公钥 (兼容简写)"),
    webhookPath: z.string().optional().default("/qqbot/webhook").describe("Webhook 路径"),
    allowFrom: z.array(z.string()).optional().describe("允许的用户 ID 列表"),
    dmPolicy: z
      .enum(["open", "allowlist", "pairing"])
      .optional()
      .default("pairing")
      .describe("私聊策略"),
    groupPolicy: z.enum(["open", "allowlist"]).optional().default("allowlist").describe("群聊策略"),
    groups: z.record(z.string(), QqbotGroupSchema.optional()).optional().describe("群聊配置"),
  })
  .passthrough();

// ============================================================================
// 个人微信 (WeChat Personal via ClawChat)
// ============================================================================

export const OpenclawwechatConfigSchema = z
  .object({
    enabled: z.boolean().optional().default(true).describe("是否启用个人微信渠道"),
    apiKey: z
      .string()
      .optional()
      .describe("ClawChat API Key (格式: bot_id:secret，在 ClawChat 中获取)"),
    pollIntervalMs: z
      .number()
      .int()
      .positive()
      .optional()
      .default(2000)
      .describe("轮询间隔 (毫秒)，默认 2000ms"),
    sessionKey: z
      .string()
      .optional()
      .default("agent:main:main")
      .describe("会话标识 (格式: agent:<agentId>:<rest>)"),
    debug: z.boolean().optional().default(false).describe("调试模式，启用详细日志"),
  })
  .passthrough();
