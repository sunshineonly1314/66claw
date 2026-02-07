/**
 * 飞书配置 Schema (Zod)
 * Feishu Config Schema
 *
 * 融合自 m1heng/clawdbot-feishu 的增强功能
 */

import { z } from "zod";

// ============================================================================
// 枚举类型定义
// ============================================================================

/** 私聊策略 */
const DmPolicySchema = z.enum(["open", "pairing", "allowlist"]);

/** 群聊策略 */
const GroupPolicySchema = z.enum(["open", "allowlist", "disabled"]);

/** 飞书域名：国内 feishu / 国际 lark */
const FeishuDomainSchema = z.enum(["feishu", "lark"]);

/** 连接模式：websocket (推荐) / webhook */
const FeishuConnectionModeSchema = z.enum(["websocket", "webhook"]);

/** 渲染模式：auto (自动检测) / raw (纯文本) / card (卡片) */
const RenderModeSchema = z.enum(["auto", "raw", "card"]);

// ============================================================================
// 子配置 Schema
// ============================================================================

/**
 * 飞书应用配置 Schema (兼容旧版嵌套结构)
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
export const FeishuGroupSchema = z
  .object({
    requireMention: z.boolean().optional().describe("是否需要 @机器人 才响应"),
    allowFrom: z.array(z.union([z.string(), z.number()])).optional().describe("允许的发送者"),
    enabled: z.boolean().optional().describe("是否启用该群"),
    systemPrompt: z.string().optional().describe("该群的系统提示词"),
  })
  .strict();

/**
 * Markdown 配置 Schema
 */
const MarkdownConfigSchema = z
  .object({
    mode: z.enum(["native", "escape", "strip"]).optional().describe("Markdown 处理模式"),
    tableMode: z.enum(["native", "ascii", "simple"]).optional().describe("表格渲染模式"),
  })
  .strict()
  .optional();

/**
 * 飞书工具配置 Schema (可选功能)
 */
const FeishuToolsConfigSchema = z
  .object({
    doc: z.boolean().optional().describe("文档操作 (默认: true)"),
    wiki: z.boolean().optional().describe("知识库操作 (默认: true)"),
    drive: z.boolean().optional().describe("云空间操作 (默认: true)"),
    perm: z.boolean().optional().describe("权限管理 (默认: false, 敏感)"),
    scopes: z.boolean().optional().describe("应用权限诊断 (默认: true)"),
  })
  .strict()
  .optional();

// ============================================================================
// 主配置 Schema
// ============================================================================

/**
 * 飞书渠道配置 Schema
 *
 * 支持两种配置风格:
 * 1. 旧版嵌套风格 (app.appId, app.appSecret)
 * 2. 新版扁平风格 (appId, appSecret) - 推荐
 */
export const FeishuConfigSchema = z
  .object({
    // ========== 基础配置 ==========
    enabled: z.boolean().optional().default(true).describe("是否启用"),

    // 新版扁平配置 (推荐)
    appId: z.string().optional().describe("飞书应用 App ID"),
    appSecret: z.string().optional().describe("飞书应用 App Secret"),
    encryptKey: z.string().optional().describe("事件订阅 Encrypt Key"),
    verificationToken: z.string().optional().describe("事件订阅 Verification Token"),

    // 旧版嵌套配置 (兼容)
    app: FeishuAppSchema.optional().describe("应用配置 (旧版, 建议使用扁平配置)"),

    // ========== 连接配置 ==========
    domain: FeishuDomainSchema.optional().default("feishu").describe("域名: feishu (国内) / lark (国际)"),
    connectionMode: FeishuConnectionModeSchema.optional().default("websocket").describe("连接模式: websocket (推荐) / webhook"),
    webhookPath: z.string().optional().default("/feishu/webhook").describe("Webhook 路径"),
    webhookPort: z.number().int().positive().optional().describe("Webhook 端口 (可选)"),

    // ========== 私聊配置 ==========
    dmPolicy: DmPolicySchema.optional().default("pairing").describe("私聊策略: open / pairing / allowlist"),
    allowFrom: z.array(z.union([z.string(), z.number()])).optional().describe("允许的用户 ID 列表"),
    dmHistoryLimit: z.number().int().min(0).optional().describe("私聊历史消息限制"),

    // ========== 群聊配置 ==========
    groupPolicy: GroupPolicySchema.optional().default("allowlist").describe("群聊策略: open / allowlist / disabled"),
    groupAllowFrom: z.array(z.union([z.string(), z.number()])).optional().describe("群聊允许的发送者"),
    requireMention: z.boolean().optional().default(true).describe("群聊是否需要 @机器人"),
    groups: z.record(z.string(), FeishuGroupSchema.optional()).optional().describe("各群聊单独配置"),
    historyLimit: z.number().int().min(0).optional().describe("群聊历史消息限制"),

    // ========== 消息配置 ==========
    renderMode: RenderModeSchema.optional().default("auto").describe("渲染模式: auto / raw / card"),
    textChunkLimit: z.number().int().positive().optional().describe("文本分片限制"),
    chunkMode: z.enum(["length", "newline"]).optional().describe("分片模式"),
    markdown: MarkdownConfigSchema.describe("Markdown 配置"),

    // ========== 媒体配置 ==========
    mediaMaxMb: z.number().positive().optional().default(30).describe("媒体最大大小 (MB)"),

    // ========== 工具配置 ==========
    tools: FeishuToolsConfigSchema.describe("工具功能开关"),
  })
  .strict()
  .superRefine((value, ctx) => {
    // 验证 dmPolicy="open" 需要 allowFrom 包含 "*"
    if (value.dmPolicy === "open") {
      const allowFrom = value.allowFrom ?? [];
      const hasWildcard = allowFrom.some((entry) => String(entry).trim() === "*");
      if (!hasWildcard) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["allowFrom"],
          message: 'dmPolicy="open" 需要 allowFrom 包含 "*"',
        });
      }
    }
  });

export type FeishuConfigSchemaType = z.infer<typeof FeishuConfigSchema>;
export type FeishuGroupSchemaType = z.infer<typeof FeishuGroupSchema>;