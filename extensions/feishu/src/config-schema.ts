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
    task: z.boolean().optional().describe("任务管理 (默认: true)"),
  })
  .strict()
  .optional();

/**
 * 高级配置 Schema
 * 在 UI 中自动渲染为可折叠的高级选项区域
 */
const FeishuAdvancedConfigSchema = z
  .object({
    streaming: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "启用流式卡片渲染 — 实时 AI 输出（默认: false）。" +
        "开启前需要在飞书开放平台为应用添加 cardkit:card 权限（路径：应用管理 → 权限管理 → 搜索 cardkit:card → 开通）",
      ),
    allowMentionlessInMultiBotGroup: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "多机器人群中是否允许不 @本机器人就响应（默认: false，安全模式）。" +
        "关闭时，当群内有多个机器人时必须 @本机器人才会回复，防止机器人之间互相触发造成消息风暴",
      ),
    tools: FeishuToolsConfigSchema.describe("工具功能开关 — 控制各飞书工具的启用/禁用"),
  })
  .strict()
  .optional();

// ============================================================================
// 主配置 Schema
// ============================================================================

/**
 * 飞书渠道配置 Schema
 */
export const FeishuConfigSchema = z
  .object({
    // ========== 基础配置 ==========
    enabled: z.boolean().optional().default(true).describe("是否启用"),

    appId: z.string().optional().describe("飞书应用 App ID (简写)"),
    appSecret: z.string().optional().describe("飞书应用 App Secret (简写)"),
    encryptKey: z.string().optional().describe("事件订阅 Encrypt Key (兼容简写)"),
    verificationToken: z.string().optional().describe("事件订阅 Verification Token (兼容简写)"),

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

    // ========== 高级配置 ==========
    advanced: FeishuAdvancedConfigSchema.describe("高级配置 — 流式卡片、多机器人安全、工具开关等"),
  })
  .passthrough()
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