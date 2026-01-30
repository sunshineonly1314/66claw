/**
 * 钉钉配置 Schema (Zod)
 * DingTalk Config Schema
 */

import { z } from "zod";

/**
 * 钉钉应用配置 Schema
 */
const DingtalkAppSchema = z
  .object({
    appKey: z.string().optional().describe("钉钉应用 AppKey"),
    appSecret: z.string().optional().describe("钉钉应用 AppSecret"),
    robotCode: z.string().optional().describe("机器人 RobotCode (可选)"),
    signSecret: z.string().optional().describe("消息加签密钥 (可选)"),
  })
  .strict();

/**
 * 钉钉群聊配置 Schema
 */
const DingtalkGroupSchema = z
  .object({
    requireMention: z.boolean().optional().describe("是否需要 @机器人 才响应"),
    allowFrom: z.array(z.string()).optional().describe("允许的发送者"),
  })
  .strict();

/**
 * 钉钉渠道配置 Schema
 */
export const DingtalkConfigSchema = z
  .object({
    enabled: z.boolean().optional().default(true).describe("是否启用"),
    app: DingtalkAppSchema.optional().describe("应用配置"),
    webhookPath: z.string().optional().default("/dingtalk/webhook").describe("Webhook 路径"),
    allowFrom: z.array(z.string()).optional().describe("允许的用户 ID 列表"),
    dmPolicy: z.enum(["open", "allowlist", "pairing"]).optional().default("pairing").describe("私聊策略"),
    groupPolicy: z.enum(["open", "allowlist"]).optional().default("allowlist").describe("群聊策略"),
    groups: z.record(z.string(), DingtalkGroupSchema.optional()).optional().describe("群聊配置"),
  })
  .strict();

export type DingtalkConfigSchemaType = z.infer<typeof DingtalkConfigSchema>;
