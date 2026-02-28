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
 * Markdown 渲染配置 Schema
 */
const DingtalkMarkdownSchema = z
  .object({
    tables: z
      .enum(["off", "bullets", "code"])
      .optional()
      .default("bullets")
      .describe("Markdown 表格转换模式: off=不转换, bullets=转为列表, code=转为代码块"),
  })
  .strict();

/**
 * 媒体下载与归档配置 Schema
 */
const DingtalkMediaSizeLimitsSchema = z
  .object({
    picture: z.number().optional().default(20).describe("图片大小限制 (MB)"),
    audio: z.number().optional().default(50).describe("语音大小限制 (MB)"),
    video: z.number().optional().default(100).describe("视频大小限制 (MB)"),
    file: z.number().optional().default(100).describe("文件大小限制 (MB)"),
  })
  .strict();

const DingtalkMediaArchivalSchema = z
  .object({
    enabled: z.boolean().optional().default(false).describe("启用媒体归档"),
    retentionDays: z.number().optional().default(7).describe("归档保留天数"),
    basePath: z.string().optional().describe("归档基础路径"),
  })
  .strict();

const DingtalkMediaSchema = z
  .object({
    enableDownload: z.boolean().optional().default(true).describe("启用入站媒体下载"),
    sizeLimits: DingtalkMediaSizeLimitsSchema.optional().describe("分类型大小限制"),
    archival: DingtalkMediaArchivalSchema.optional().describe("媒体归档设置"),
  })
  .strict();

/**
 * 定时任务配置 Schema
 */
const DingtalkScheduledTaskSchema = z
  .object({
    id: z.string().describe("任务 ID"),
    cron: z.string().describe("Cron 表达式 (分 时 日 月 周)"),
    targets: z.array(z.string()).describe("目标用户 ID 列表"),
    messageTemplate: z.string().describe("消息模板 (支持 {date}, {time}, {weekday} 变量)"),
    markdown: z.boolean().optional().default(false).describe("使用 Markdown 格式"),
    enabled: z.boolean().optional().default(true).describe("是否启用"),
  })
  .strict();

/**
 * 钉钉渠道配置 Schema
 */
export const DingtalkConfigSchema = z
  .object({
    enabled: z.boolean().optional().default(true).describe("是否启用"),
    mode: z.enum(["webhook", "stream"]).optional().default("stream").describe("接入模式: webhook 或 stream"),
    app: DingtalkAppSchema.optional().describe("应用配置"),
    webhookPath: z.string().optional().default("/dingtalk/webhook").describe("Webhook 路径 (Webhook 模式专用)"),
    stream: DingtalkStreamSchema.optional().describe("Stream 模式配置"),
    allowFrom: z.array(z.string()).optional().describe("允许的用户 ID 列表"),
    dmPolicy: z.enum(["open", "allowlist", "pairing"]).optional().default("pairing").describe("私聊策略"),
    groupPolicy: z.enum(["open", "allowlist"]).optional().default("allowlist").describe("群聊策略"),
    groups: z.record(z.string(), DingtalkGroupSchema.optional()).optional().describe("群聊配置"),
    markdown: DingtalkMarkdownSchema.optional().describe("Markdown 渲染设置"),
    media: DingtalkMediaSchema.optional().describe("媒体下载与归档配置"),
    scheduledTasks: z.array(DingtalkScheduledTaskSchema).optional().describe("定时消息任务"),
  })
  .strict();

export type DingtalkConfigSchemaType = z.infer<typeof DingtalkConfigSchema>;
