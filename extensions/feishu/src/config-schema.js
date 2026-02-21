import { z } from "zod";
const DmPolicySchema = z.enum(["open", "pairing", "allowlist"]);
const GroupPolicySchema = z.enum(["open", "allowlist", "disabled"]);
const FeishuDomainSchema = z.enum(["feishu", "lark"]);
const FeishuConnectionModeSchema = z.enum(["websocket", "webhook"]);
const RenderModeSchema = z.enum(["auto", "raw", "card"]);
const FeishuAppSchema = z.object({
  appId: z.string().optional().describe("\u98DE\u4E66\u5E94\u7528 App ID"),
  appSecret: z.string().optional().describe("\u98DE\u4E66\u5E94\u7528 App Secret"),
  verificationToken: z.string().optional().describe("\u4E8B\u4EF6\u8BA2\u9605 Verification Token"),
  encryptKey: z.string().optional().describe("\u4E8B\u4EF6\u8BA2\u9605 Encrypt Key (\u53EF\u9009)")
}).strict();
const FeishuGroupSchema = z.object({
  requireMention: z.boolean().optional().describe("\u662F\u5426\u9700\u8981 @\u673A\u5668\u4EBA \u624D\u54CD\u5E94"),
  allowFrom: z.array(z.union([z.string(), z.number()])).optional().describe("\u5141\u8BB8\u7684\u53D1\u9001\u8005"),
  enabled: z.boolean().optional().describe("\u662F\u5426\u542F\u7528\u8BE5\u7FA4"),
  systemPrompt: z.string().optional().describe("\u8BE5\u7FA4\u7684\u7CFB\u7EDF\u63D0\u793A\u8BCD")
}).strict();
const MarkdownConfigSchema = z.object({
  mode: z.enum(["native", "escape", "strip"]).optional().describe("Markdown \u5904\u7406\u6A21\u5F0F"),
  tableMode: z.enum(["native", "ascii", "simple"]).optional().describe("\u8868\u683C\u6E32\u67D3\u6A21\u5F0F")
}).strict().optional();
const FeishuToolsConfigSchema = z.object({
  doc: z.boolean().optional().describe("\u6587\u6863\u64CD\u4F5C (\u9ED8\u8BA4: true)"),
  wiki: z.boolean().optional().describe("\u77E5\u8BC6\u5E93\u64CD\u4F5C (\u9ED8\u8BA4: true)"),
  drive: z.boolean().optional().describe("\u4E91\u7A7A\u95F4\u64CD\u4F5C (\u9ED8\u8BA4: true)"),
  perm: z.boolean().optional().describe("\u6743\u9650\u7BA1\u7406 (\u9ED8\u8BA4: false, \u654F\u611F)"),
  scopes: z.boolean().optional().describe("\u5E94\u7528\u6743\u9650\u8BCA\u65AD (\u9ED8\u8BA4: true)")
}).strict().optional();
const FeishuConfigSchema = z.object({
  // ========== 基础配置 ==========
  enabled: z.boolean().optional().default(true).describe("\u662F\u5426\u542F\u7528"),
  // 新版扁平配置 (推荐)
  appId: z.string().optional().describe("\u98DE\u4E66\u5E94\u7528 App ID"),
  appSecret: z.string().optional().describe("\u98DE\u4E66\u5E94\u7528 App Secret"),
  encryptKey: z.string().optional().describe("\u4E8B\u4EF6\u8BA2\u9605 Encrypt Key"),
  verificationToken: z.string().optional().describe("\u4E8B\u4EF6\u8BA2\u9605 Verification Token"),
  // 旧版嵌套配置 (兼容)
  app: FeishuAppSchema.optional().describe("\u5E94\u7528\u914D\u7F6E (\u65E7\u7248, \u5EFA\u8BAE\u4F7F\u7528\u6241\u5E73\u914D\u7F6E)"),
  // ========== 连接配置 ==========
  domain: FeishuDomainSchema.optional().default("feishu").describe("\u57DF\u540D: feishu (\u56FD\u5185) / lark (\u56FD\u9645)"),
  connectionMode: FeishuConnectionModeSchema.optional().default("websocket").describe("\u8FDE\u63A5\u6A21\u5F0F: websocket (\u63A8\u8350) / webhook"),
  webhookPath: z.string().optional().default("/feishu/webhook").describe("Webhook \u8DEF\u5F84"),
  webhookPort: z.number().int().positive().optional().describe("Webhook \u7AEF\u53E3 (\u53EF\u9009)"),
  // ========== 私聊配置 ==========
  dmPolicy: DmPolicySchema.optional().default("pairing").describe("\u79C1\u804A\u7B56\u7565: open / pairing / allowlist"),
  allowFrom: z.array(z.union([z.string(), z.number()])).optional().describe("\u5141\u8BB8\u7684\u7528\u6237 ID \u5217\u8868"),
  dmHistoryLimit: z.number().int().min(0).optional().describe("\u79C1\u804A\u5386\u53F2\u6D88\u606F\u9650\u5236"),
  // ========== 群聊配置 ==========
  groupPolicy: GroupPolicySchema.optional().default("allowlist").describe("\u7FA4\u804A\u7B56\u7565: open / allowlist / disabled"),
  groupAllowFrom: z.array(z.union([z.string(), z.number()])).optional().describe("\u7FA4\u804A\u5141\u8BB8\u7684\u53D1\u9001\u8005"),
  requireMention: z.boolean().optional().default(true).describe("\u7FA4\u804A\u662F\u5426\u9700\u8981 @\u673A\u5668\u4EBA"),
  groups: z.record(z.string(), FeishuGroupSchema.optional()).optional().describe("\u5404\u7FA4\u804A\u5355\u72EC\u914D\u7F6E"),
  historyLimit: z.number().int().min(0).optional().describe("\u7FA4\u804A\u5386\u53F2\u6D88\u606F\u9650\u5236"),
  // ========== 消息配置 ==========
  renderMode: RenderModeSchema.optional().default("auto").describe("\u6E32\u67D3\u6A21\u5F0F: auto / raw / card"),
  textChunkLimit: z.number().int().positive().optional().describe("\u6587\u672C\u5206\u7247\u9650\u5236"),
  chunkMode: z.enum(["length", "newline"]).optional().describe("\u5206\u7247\u6A21\u5F0F"),
  markdown: MarkdownConfigSchema.describe("Markdown \u914D\u7F6E"),
  // ========== 媒体配置 ==========
  mediaMaxMb: z.number().positive().optional().default(30).describe("\u5A92\u4F53\u6700\u5927\u5927\u5C0F (MB)"),
  // ========== 工具配置 ==========
  tools: FeishuToolsConfigSchema.describe("\u5DE5\u5177\u529F\u80FD\u5F00\u5173")
}).strict().superRefine((value, ctx) => {
  if (value.dmPolicy === "open") {
    const allowFrom = value.allowFrom ?? [];
    const hasWildcard = allowFrom.some((entry) => String(entry).trim() === "*");
    if (!hasWildcard) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allowFrom"],
        message: 'dmPolicy="open" \u9700\u8981 allowFrom \u5305\u542B "*"'
      });
    }
  }
});
export {
  FeishuConfigSchema,
  FeishuGroupSchema
};
