/**
 * 企业微信配置 Schema
 * WeCom Config Schema
 */

import { z } from "zod";

const WecomAppSchema = z
  .object({
    corpId: z.string().describe("企业 ID (CorpID)"),
    agentSecret: z.string().describe("应用 Secret"),
    agentId: z.number().int().positive().describe("应用 AgentId"),
    token: z.string().optional().describe("回调 Token (用于验证)"),
    encodingAESKey: z.string().optional().describe("回调 EncodingAESKey (用于加解密)"),
  })
  .describe("企业微信应用配置");

const WecomGroupSchema = z
  .object({
    requireMention: z.boolean().optional().describe("是否需要 @机器人 才响应"),
    allowFrom: z.array(z.string()).optional().describe("允许的发送者 ID 列表"),
  })
  .describe("群聊配置");

export const WecomConfigSchema = z
  .object({
    enabled: z.boolean().optional().default(true).describe("是否启用"),
    app: WecomAppSchema.optional().describe("应用配置"),
    webhookPath: z.string().optional().default("/wecom/webhook").describe("Webhook 路径"),
    allowFrom: z.array(z.string()).optional().describe("允许的用户 ID 列表"),
    dmPolicy: z.enum(["open", "allowlist", "pairing"]).optional().default("allowlist").describe("私聊策略"),
    groupPolicy: z.enum(["open", "allowlist"]).optional().default("allowlist").describe("群聊策略"),
    groups: z.record(z.string(), WecomGroupSchema.optional()).optional().describe("群聊配置"),
  })
  .describe("企业微信渠道配置");

export type WecomConfigSchemaType = z.infer<typeof WecomConfigSchema>;
