/**
 * QQ 机器人配置 Schema (Zod)
 * QQ Bot Config Schema
 *
 * 基于 QQ 开放平台 API
 * 文档: https://q.qq.com/wiki/develop/api-v2/
 */

import { z } from "zod";

/**
 * QQ 机器人应用配置 Schema
 */
const QqbotAppSchema = z
  .object({
    appId: z.string().optional().describe("QQ 机器人 AppID"),
    appSecret: z.string().optional().describe("QQ 机器人 AppSecret (ClientSecret)"),
    token: z.string().optional().describe("QQ 机器人 Token (用于验证回调)"),
    publicKey: z.string().optional().describe("QQ 机器人公钥 (用于 Ed25519 签名验证，hex 格式)"),
  })
  .strict();

/**
 * QQ 机器人群聊配置 Schema
 */
const QqbotGroupSchema = z
  .object({
    requireMention: z.boolean().optional().describe("是否需要 @机器人 才响应"),
    allowFrom: z.array(z.string()).optional().describe("允许的发送者"),
  })
  .strict();

/**
 * QQ 机器人渠道配置 Schema
 */
export const QqbotConfigSchema = z
  .object({
    enabled: z.boolean().optional().default(true).describe("是否启用"),
    sandbox: z.boolean().optional().default(false).describe("是否使用沙箱环境"),
    app: QqbotAppSchema.optional().describe("应用配置"),
    webhookPath: z.string().optional().default("/qqbot/webhook").describe("Webhook 路径"),
    allowFrom: z.array(z.string()).optional().describe("允许的用户 ID 列表"),
    dmPolicy: z.enum(["open", "allowlist", "pairing"]).optional().default("pairing").describe("私聊策略"),
    groupPolicy: z.enum(["open", "allowlist"]).optional().default("allowlist").describe("群聊策略"),
    groups: z.record(z.string(), QqbotGroupSchema.optional()).optional().describe("群聊配置"),
  })
  .strict();

export type QqbotConfigSchemaType = z.infer<typeof QqbotConfigSchema>;
