import { z } from "zod";
const WikiActionSchema = z.enum([
  "spaces",
  // 列出所有知识库空间
  "nodes",
  // 列出节点
  "get",
  // 获取节点详情
  "create",
  // 创建节点
  "move",
  // 移动节点
  "rename"
  // 重命名节点
]);
const FeishuWikiSchema = z.object({
  action: WikiActionSchema.describe("\u64CD\u4F5C\u7C7B\u578B"),
  space_id: z.string().optional().describe("\u77E5\u8BC6\u5E93\u7A7A\u95F4 ID (\u7528\u4E8E nodes/create/move/rename)"),
  parent_node_token: z.string().optional().describe("\u7236\u8282\u70B9 token (\u7528\u4E8E nodes/create)"),
  token: z.string().optional().describe("\u8282\u70B9 token (\u7528\u4E8E get)"),
  node_token: z.string().optional().describe("\u8282\u70B9 token (\u7528\u4E8E move/rename)"),
  title: z.string().optional().describe("\u8282\u70B9\u6807\u9898 (\u7528\u4E8E create/rename)"),
  obj_type: z.enum(["doc", "sheet", "mindnote", "bitable", "file", "docx", "slides"]).optional().describe("\u5BF9\u8C61\u7C7B\u578B (\u7528\u4E8E create\uFF0C\u9ED8\u8BA4 docx)"),
  target_space_id: z.string().optional().describe("\u76EE\u6807\u7A7A\u95F4 ID (\u7528\u4E8E move)"),
  target_parent_token: z.string().optional().describe("\u76EE\u6807\u7236\u8282\u70B9 token (\u7528\u4E8E move)")
}).superRefine((data, ctx) => {
  if (data.action === "nodes" && !data.space_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "nodes \u64CD\u4F5C\u9700\u8981 space_id",
      path: ["space_id"]
    });
  }
  if (data.action === "get" && !data.token) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "get \u64CD\u4F5C\u9700\u8981 token",
      path: ["token"]
    });
  }
  if (data.action === "create" && (!data.space_id || !data.title)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "create \u64CD\u4F5C\u9700\u8981 space_id \u548C title",
      path: ["space_id"]
    });
  }
  if (data.action === "move" && (!data.space_id || !data.node_token)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "move \u64CD\u4F5C\u9700\u8981 space_id \u548C node_token",
      path: ["node_token"]
    });
  }
  if (data.action === "rename" && (!data.space_id || !data.node_token || !data.title)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "rename \u64CD\u4F5C\u9700\u8981 space_id, node_token \u548C title",
      path: ["title"]
    });
  }
});
const FeishuWikiJsonSchema = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["spaces", "nodes", "get", "create", "move", "rename"],
      description: "\u64CD\u4F5C\u7C7B\u578B: spaces(\u5217\u51FA\u7A7A\u95F4), nodes(\u5217\u51FA\u8282\u70B9), get(\u83B7\u53D6\u8BE6\u60C5), create(\u521B\u5EFA), move(\u79FB\u52A8), rename(\u91CD\u547D\u540D)"
    },
    space_id: {
      type: "string",
      description: "\u77E5\u8BC6\u5E93\u7A7A\u95F4 ID"
    },
    parent_node_token: {
      type: "string",
      description: "\u7236\u8282\u70B9 token\uFF0C\u7528\u4E8E\u5217\u51FA\u5B50\u8282\u70B9\u6216\u5728\u6307\u5B9A\u4F4D\u7F6E\u521B\u5EFA"
    },
    token: {
      type: "string",
      description: "\u8282\u70B9 token\uFF0C\u7528\u4E8E\u83B7\u53D6\u8BE6\u60C5"
    },
    node_token: {
      type: "string",
      description: "\u8282\u70B9 token\uFF0C\u7528\u4E8E\u79FB\u52A8/\u91CD\u547D\u540D"
    },
    title: {
      type: "string",
      description: "\u8282\u70B9\u6807\u9898"
    },
    obj_type: {
      type: "string",
      enum: ["doc", "sheet", "mindnote", "bitable", "file", "docx", "slides"],
      description: "\u5BF9\u8C61\u7C7B\u578B\uFF0C\u9ED8\u8BA4 docx"
    },
    target_space_id: {
      type: "string",
      description: "\u76EE\u6807\u7A7A\u95F4 ID\uFF0C\u7528\u4E8E\u8DE8\u7A7A\u95F4\u79FB\u52A8"
    },
    target_parent_token: {
      type: "string",
      description: "\u76EE\u6807\u7236\u8282\u70B9 token\uFF0C\u7528\u4E8E\u79FB\u52A8\u5230\u6307\u5B9A\u4F4D\u7F6E"
    }
  },
  required: ["action"]
};
export {
  FeishuWikiJsonSchema,
  FeishuWikiSchema
};
