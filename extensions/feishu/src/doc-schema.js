import { z } from "zod";
const DocActionSchema = z.enum([
  "read",
  // 读取文档内容
  "write",
  // 覆盖写入文档
  "append",
  // 追加内容到文档
  "create",
  // 创建新文档
  "list_blocks",
  // 列出所有块
  "get_block",
  // 获取单个块
  "update_block",
  // 更新块内容
  "delete_block"
  // 删除块
]);
const FeishuDocSchema = z.object({
  action: DocActionSchema.describe("\u64CD\u4F5C\u7C7B\u578B"),
  doc_token: z.string().optional().describe("\u6587\u6863 token (\u4ECE URL \u83B7\u53D6\uFF0C\u5982 /docx/xxxxx \u4E2D\u7684 xxxxx)"),
  content: z.string().optional().describe("Markdown \u683C\u5F0F\u7684\u5185\u5BB9 (\u7528\u4E8E write/append/update_block)"),
  title: z.string().optional().describe("\u6587\u6863\u6807\u9898 (\u7528\u4E8E create)"),
  folder_token: z.string().optional().describe("\u76EE\u6807\u6587\u4EF6\u5939 token (\u7528\u4E8E create\uFF0C\u53EF\u9009)"),
  block_id: z.string().optional().describe("\u5757 ID (\u7528\u4E8E get_block/update_block/delete_block)")
}).superRefine((data, ctx) => {
  if (data.action === "read" && !data.doc_token) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "read \u64CD\u4F5C\u9700\u8981 doc_token",
      path: ["doc_token"]
    });
  }
  if (data.action === "write" && (!data.doc_token || !data.content)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "write \u64CD\u4F5C\u9700\u8981 doc_token \u548C content",
      path: ["doc_token"]
    });
  }
  if (data.action === "append" && (!data.doc_token || !data.content)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "append \u64CD\u4F5C\u9700\u8981 doc_token \u548C content",
      path: ["doc_token"]
    });
  }
  if (data.action === "create" && !data.title) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "create \u64CD\u4F5C\u9700\u8981 title",
      path: ["title"]
    });
  }
  if (data.action === "list_blocks" && !data.doc_token) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "list_blocks \u64CD\u4F5C\u9700\u8981 doc_token",
      path: ["doc_token"]
    });
  }
  if (data.action === "get_block" && (!data.doc_token || !data.block_id)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "get_block \u64CD\u4F5C\u9700\u8981 doc_token \u548C block_id",
      path: ["block_id"]
    });
  }
  if (data.action === "update_block" && (!data.doc_token || !data.block_id || !data.content)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "update_block \u64CD\u4F5C\u9700\u8981 doc_token, block_id \u548C content",
      path: ["block_id"]
    });
  }
  if (data.action === "delete_block" && (!data.doc_token || !data.block_id)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "delete_block \u64CD\u4F5C\u9700\u8981 doc_token \u548C block_id",
      path: ["block_id"]
    });
  }
});
const FeishuDocJsonSchema = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["read", "write", "append", "create", "list_blocks", "get_block", "update_block", "delete_block"],
      description: "\u64CD\u4F5C\u7C7B\u578B: read(\u8BFB\u53D6), write(\u8986\u76D6\u5199\u5165), append(\u8FFD\u52A0), create(\u521B\u5EFA), list_blocks(\u5217\u51FA\u5757), get_block(\u83B7\u53D6\u5757), update_block(\u66F4\u65B0\u5757), delete_block(\u5220\u9664\u5757)"
    },
    doc_token: {
      type: "string",
      description: "\u6587\u6863 token\uFF0C\u4ECE URL \u83B7\u53D6\uFF0C\u5982 /docx/xxxxx \u4E2D\u7684 xxxxx"
    },
    content: {
      type: "string",
      description: "Markdown \u683C\u5F0F\u7684\u5185\u5BB9\uFF0C\u7528\u4E8E write/append/update_block \u64CD\u4F5C"
    },
    title: {
      type: "string",
      description: "\u6587\u6863\u6807\u9898\uFF0C\u7528\u4E8E create \u64CD\u4F5C"
    },
    folder_token: {
      type: "string",
      description: "\u76EE\u6807\u6587\u4EF6\u5939 token\uFF0C\u7528\u4E8E create \u64CD\u4F5C\uFF08\u53EF\u9009\uFF09"
    },
    block_id: {
      type: "string",
      description: "\u5757 ID\uFF0C\u7528\u4E8E get_block/update_block/delete_block \u64CD\u4F5C"
    }
  },
  required: ["action"]
};
export {
  FeishuDocJsonSchema,
  FeishuDocSchema
};
