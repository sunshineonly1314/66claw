/**
 * 钉钉配置 Schema (Zod)
 * DingTalk Config Schema
 *
 * 支持两种接入模式:
 * - webhook: HTTP Webhook 模式 (需要公网 IP)
 * - stream: Stream WebSocket 模式 (无需公网 IP，支持 AI Card 流式响应)
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
    debug: z.boolean().optional().describe("调试模式"),
  })
  .strict();

/**
 * Stream 模式配置 Schema
 */
const DingtalkStreamSchema = z
  .object({
    enableAICard: z.boolean().optional().default(true).describe("启用 AI Card 流式响应 (打字机效果)"),
    sessionTimeout: z.number().optional().default(1800000).describe("会话超时时间 (ms)，默认 30 分钟"),
    enableMediaUpload: z.boolean().optional().default(true).describe("启用图片自动上传"),
    systemPrompt: z.string().optional().describe("自定义 system prompt"),
    gatewayToken: z.string().optional().describe("Gateway 认证 token"),
    gatewayPassword: z.string().optional().describe("Gateway 认证 password (与 token 二选一)"),
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
    mode: z.enum(["webhook", "stream"]).optional().default("webhook").describe("接入模式: webhook 或 stream"),
    app: DingtalkAppSchema.optional().describe("应用配置"),
    webhookPath: z.string().optional().default("/dingtalk/webhook").describe("Webhook 路径 (Webhook 模式专用)"),
    stream: DingtalkStreamSchema.optional().describe("Stream 模式配置"),
    allowFrom: z.array(z.string()).optional().describe("允许的用户 ID 列表"),
    dmPolicy: z.enum(["open", "allowlist", "pairing"]).optional().default("pairing").describe("私聊策略"),
    groupPolicy: z.enum(["open", "allowlist"]).optional().default("allowlist").describe("群聊策略"),
    groups: z.record(z.string(), DingtalkGroupSchema.optional()).optional().describe("群聊配置"),
  })
  .strict();

export type DingtalkConfigSchemaType = z.infer<typeof DingtalkConfigSchema>;
