/**
 * 飞书配置 Schema (Zod)
 * Feishu Config Schema
 */

import { z } from "zod";

/**
 * 飞书应用配置 Schema
 */
const FeishuAppSchema = z
  .object({
    appId: z.string().optional().describe("飞书应用 App ID"),
    appSecret: z.string().optional().describe("飞书应用 App Secret"),
    verificationToken: z.string().optional().describe("事件订阅 Verification Token"),
    encryptKey: z.string().optional().describe("事件订阅 Encrypt Key (可选)"),
  })
  .strict();

/**
 * 飞书群聊配置 Schema
 */
const FeishuGroupSchema = z
  .object({
    requireMention: z.boolean().optional().describe("是否需要 @机器人 才响应"),
    allowFrom: z.array(z.string()).optional().describe("允许的发送者"),
  })
  .strict();

/**
 * 飞书渠道配置 Schema
 */
export const FeishuConfigSchema = z
  .object({
    enabled: z.boolean().optional().default(true).describe("是否启用"),
    app: FeishuAppSchema.optional().describe("应用配置"),
    webhookPath: z.string().optional().default("/feishu/webhook").describe("Webhook 路径"),
    allowFrom: z.array(z.string()).optional().describe("允许的用户 ID 列表"),
    dmPolicy: z.enum(["open", "allowlist", "pairing"]).optional().default("pairing").describe("私聊策略"),
    groupPolicy: z.enum(["open", "allowlist"]).optional().default("allowlist").describe("群聊策略"),
    groups: z.record(z.string(), FeishuGroupSchema.optional()).optional().describe("群聊配置"),
  })
  .strict();

export type FeishuConfigSchemaType = z.infer<typeof FeishuConfigSchema>;
