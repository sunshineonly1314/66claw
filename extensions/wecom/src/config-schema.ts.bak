/**
 * 企业微信配置 Schema
 * WeCom Config Schema
 *
 * 支持多账户配置，参考 moltbot-china 的设计模式
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

/**
 * 账户配置 Schema (用于 accounts 字段)
 */
const WecomAccountSchema = z
  .object({
    name: z.string().optional().describe("账户名称 (用于显示)"),
    enabled: z.boolean().optional().default(true).describe("是否启用此账户"),
    app: WecomAppSchema.optional().describe("应用配置"),
    webhookPath: z.string().optional().describe("Webhook 路径 (每个账户可以不同)"),
    allowFrom: z.array(z.string()).optional().describe("允许的用户 ID 列表"),
    groupAllowFrom: z.array(z.string()).optional().describe("允许的群 ID 列表"),
    dmPolicy: z.enum(["open", "allowlist", "pairing"]).optional().describe("私聊策略"),
    groupPolicy: z.enum(["open", "allowlist", "disabled"]).optional().describe("群聊策略"),
    requireMention: z.boolean().optional().describe("群聊是否需要 @机器人 才响应"),
    groups: z.record(z.string(), WecomGroupSchema.optional()).optional().describe("群聊配置"),
  })
  .describe("企业微信账户配置");

export const WecomConfigSchema = z
  .object({
    enabled: z.boolean().optional().default(true).describe("是否启用"),
    app: WecomAppSchema.optional().describe("应用配置 (单账户模式)"),
    webhookPath: z.string().optional().default("/wecom/webhook").describe("Webhook 路径"),
    allowFrom: z.array(z.string()).optional().describe("允许的用户 ID 列表 (私聊白名单)"),
    groupAllowFrom: z.array(z.string()).optional().describe("允许的群 ID 列表 (群聊白名单)"),
    dmPolicy: z.enum(["open", "allowlist", "pairing"]).optional().default("allowlist").describe("私聊策略"),
    groupPolicy: z.enum(["open", "allowlist", "disabled"]).optional().default("allowlist").describe("群聊策略: open=所有群, allowlist=白名单群, disabled=禁用群聊"),
    requireMention: z.boolean().optional().default(true).describe("群聊是否需要 @机器人 才响应"),
    groups: z.record(z.string(), WecomGroupSchema.optional()).optional().describe("群聊配置 (按群 ID 单独配置)"),
    // 多账户支持
    accounts: z.record(z.string(), WecomAccountSchema).optional().describe("多账户配置 (accountId -> 账户配置)"),
    defaultAccount: z.string().optional().describe("默认账户 ID (多账户模式下使用)"),
  })
  .describe("企业微信渠道配置");

export type WecomConfigSchemaType = z.infer<typeof WecomConfigSchema>;
export type WecomAccountSchemaType = z.infer<typeof WecomAccountSchema>;