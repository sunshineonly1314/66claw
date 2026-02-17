/**
 * 个人微信配置 Schema
 * WeChat Personal Config Schema
 *
 * 通过 ClawChat 桥接服务接入个人微信
 */

import { z } from "zod";

export const WechatMiniprogramConfigSchema = z
  .object({
    enabled: z
      .boolean()
      .optional()
      .default(true)
      .describe("是否启用个人微信渠道"),
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
    debug: z
      .boolean()
      .optional()
      .default(false)
      .describe("调试模式，启用详细日志"),
  })
  .describe("个人微信渠道配置 (通过 ClawChat 桥接)");

export type WechatMiniprogramConfigSchemaType = z.infer<
  typeof WechatMiniprogramConfigSchema
>;
