/**
 * 飞书文档工具 Schema
 * Feishu Document Tool Schema
 *
 * 使用 Zod 定义参数验证
 * 融合自 m1heng/clawdbot-feishu
 */

import { z } from "zod";

/**
 * 文档操作 Action 枚举
 */
const DocActionSchema = z.enum([
  "read",         // 读取文档内容
  "write",        // 覆盖写入文档
  "append",       // 追加内容到文档
  "create",       // 创建新文档
  "list_blocks",  // 列出所有块
  "get_block",    // 获取单个块
  "update_block", // 更新块内容
  "delete_block", // 删除块
]);

export type DocAction = z.infer<typeof DocActionSchema>;

/**
 * 文档工具参数 Schema
 */
export const FeishuDocSchema = z.object({
  action: DocActionSchema.describe("操作类型"),
  doc_token: z.string().optional().describe("文档 token (从 URL 获取，如 /docx/xxxxx 中的 xxxxx)"),
  content: z.string().optional().describe("Markdown 格式的内容 (用于 write/append/update_block)"),
  title: z.string().optional().describe("文档标题 (用于 create)"),
  folder_token: z.string().optional().describe("目标文件夹 token (用于 create，可选)"),
  block_id: z.string().optional().describe("块 ID (用于 get_block/update_block/delete_block)"),
}).superRefine((data, ctx) => {
  // 验证必需参数
  if (data.action === "read" && !data.doc_token) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "read 操作需要 doc_token",
      path: ["doc_token"],
    });
  }
  if (data.action === "write" && (!data.doc_token || !data.content)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "write 操作需要 doc_token 和 content",
      path: ["doc_token"],
    });
  }
  if (data.action === "append" && (!data.doc_token || !data.content)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "append 操作需要 doc_token 和 content",
      path: ["doc_token"],
    });
  }
  if (data.action === "create" && !data.title) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "create 操作需要 title",
      path: ["title"],
    });
  }
  if (data.action === "list_blocks" && !data.doc_token) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "list_blocks 操作需要 doc_token",
      path: ["doc_token"],
    });
  }
  if (data.action === "get_block" && (!data.doc_token || !data.block_id)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "get_block 操作需要 doc_token 和 block_id",
      path: ["block_id"],
    });
  }
  if (data.action === "update_block" && (!data.doc_token || !data.block_id || !data.content)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "update_block 操作需要 doc_token, block_id 和 content",
      path: ["block_id"],
    });
  }
  if (data.action === "delete_block" && (!data.doc_token || !data.block_id)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "delete_block 操作需要 doc_token 和 block_id",
      path: ["block_id"],
    });
  }
});

export type FeishuDocParams = z.infer<typeof FeishuDocSchema>;

/**
 * 转换为 JSON Schema (用于工具注册)
 */
export const FeishuDocJsonSchema = {
  type: "object" as const,
  properties: {
    action: {
      type: "string",
      enum: ["read", "write", "append", "create", "list_blocks", "get_block", "update_block", "delete_block"],
      description: "操作类型: read(读取), write(覆盖写入), append(追加), create(创建), list_blocks(列出块), get_block(获取块), update_block(更新块), delete_block(删除块)",
    },
    doc_token: {
      type: "string",
      description: "文档 token，从 URL 获取，如 /docx/xxxxx 中的 xxxxx",
    },
    content: {
      type: "string",
      description: "Markdown 格式的内容，用于 write/append/update_block 操作",
    },
    title: {
      type: "string",
      description: "文档标题，用于 create 操作",
    },
    folder_token: {
      type: "string",
      description: "目标文件夹 token，用于 create 操作（可选）",
    },
    block_id: {
      type: "string",
      description: "块 ID，用于 get_block/update_block/delete_block 操作",
    },
  },
  required: ["action"],
};
