/**
 * 飞书知识库工具 Schema
 * Feishu Wiki Tool Schema
 *
 * 使用 Zod 定义参数验证
 * 融合自 m1heng/clawdbot-feishu
 */

import { z } from "zod";

/**
 * 知识库操作 Action 枚举
 */
const WikiActionSchema = z.enum([
  "spaces",  // 列出所有知识库空间
  "nodes",   // 列出节点
  "get",     // 获取节点详情
  "create",  // 创建节点
  "move",    // 移动节点
  "rename",  // 重命名节点
]);

export type WikiAction = z.infer<typeof WikiActionSchema>;

/**
 * 知识库工具参数 Schema
 */
export const FeishuWikiSchema = z.object({
  action: WikiActionSchema.describe("操作类型"),
  space_id: z.string().optional().describe("知识库空间 ID (用于 nodes/create/move/rename)"),
  parent_node_token: z.string().optional().describe("父节点 token (用于 nodes/create)"),
  token: z.string().optional().describe("节点 token (用于 get)"),
  node_token: z.string().optional().describe("节点 token (用于 move/rename)"),
  title: z.string().optional().describe("节点标题 (用于 create/rename)"),
  obj_type: z.enum(["doc", "sheet", "mindnote", "bitable", "file", "docx", "slides"]).optional().describe("对象类型 (用于 create，默认 docx)"),
  target_space_id: z.string().optional().describe("目标空间 ID (用于 move)"),
  target_parent_token: z.string().optional().describe("目标父节点 token (用于 move)"),
}).superRefine((data, ctx) => {
  // 验证必需参数
  if (data.action === "nodes" && !data.space_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "nodes 操作需要 space_id",
      path: ["space_id"],
    });
  }
  if (data.action === "get" && !data.token) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "get 操作需要 token",
      path: ["token"],
    });
  }
  if (data.action === "create" && (!data.space_id || !data.title)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "create 操作需要 space_id 和 title",
      path: ["space_id"],
    });
  }
  if (data.action === "move" && (!data.space_id || !data.node_token)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "move 操作需要 space_id 和 node_token",
      path: ["node_token"],
    });
  }
  if (data.action === "rename" && (!data.space_id || !data.node_token || !data.title)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "rename 操作需要 space_id, node_token 和 title",
      path: ["title"],
    });
  }
});

export type FeishuWikiParams = z.infer<typeof FeishuWikiSchema>;

/**
 * 转换为 JSON Schema (用于工具注册)
 */
export const FeishuWikiJsonSchema = {
  type: "object" as const,
  properties: {
    action: {
      type: "string",
      enum: ["spaces", "nodes", "get", "create", "move", "rename"],
      description: "操作类型: spaces(列出空间), nodes(列出节点), get(获取详情), create(创建), move(移动), rename(重命名)",
    },
    space_id: {
      type: "string",
      description: "知识库空间 ID",
    },
    parent_node_token: {
      type: "string",
      description: "父节点 token，用于列出子节点或在指定位置创建",
    },
    token: {
      type: "string",
      description: "节点 token，用于获取详情",
    },
    node_token: {
      type: "string",
      description: "节点 token，用于移动/重命名",
    },
    title: {
      type: "string",
      description: "节点标题",
    },
    obj_type: {
      type: "string",
      enum: ["doc", "sheet", "mindnote", "bitable", "file", "docx", "slides"],
      description: "对象类型，默认 docx",
    },
    target_space_id: {
      type: "string",
      description: "目标空间 ID，用于跨空间移动",
    },
    target_parent_token: {
      type: "string",
      description: "目标父节点 token，用于移动到指定位置",
    },
  },
  required: ["action"],
};
