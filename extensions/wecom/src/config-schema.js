import { z } from "zod";
const WecomAppSchema = z.object({
  corpId: z.string().describe("\u4F01\u4E1A ID (CorpID)"),
  agentSecret: z.string().describe("\u5E94\u7528 Secret"),
  agentId: z.number().int().positive().describe("\u5E94\u7528 AgentId"),
  token: z.string().optional().describe("\u56DE\u8C03 Token (\u7528\u4E8E\u9A8C\u8BC1)"),
  encodingAESKey: z.string().optional().describe("\u56DE\u8C03 EncodingAESKey (\u7528\u4E8E\u52A0\u89E3\u5BC6)")
}).describe("\u4F01\u4E1A\u5FAE\u4FE1\u5E94\u7528\u914D\u7F6E");
const WecomGroupSchema = z.object({
  requireMention: z.boolean().optional().describe("\u662F\u5426\u9700\u8981 @\u673A\u5668\u4EBA \u624D\u54CD\u5E94"),
  allowFrom: z.array(z.string()).optional().describe("\u5141\u8BB8\u7684\u53D1\u9001\u8005 ID \u5217\u8868")
}).describe("\u7FA4\u804A\u914D\u7F6E");
const WecomAccountSchema = z.object({
  name: z.string().optional().describe("\u8D26\u6237\u540D\u79F0 (\u7528\u4E8E\u663E\u793A)"),
  enabled: z.boolean().optional().default(true).describe("\u662F\u5426\u542F\u7528\u6B64\u8D26\u6237"),
  app: WecomAppSchema.optional().describe("\u5E94\u7528\u914D\u7F6E"),
  webhookPath: z.string().optional().describe("Webhook \u8DEF\u5F84 (\u6BCF\u4E2A\u8D26\u6237\u53EF\u4EE5\u4E0D\u540C)"),
  allowFrom: z.array(z.string()).optional().describe("\u5141\u8BB8\u7684\u7528\u6237 ID \u5217\u8868"),
  groupAllowFrom: z.array(z.string()).optional().describe("\u5141\u8BB8\u7684\u7FA4 ID \u5217\u8868"),
  dmPolicy: z.enum(["open", "allowlist", "pairing"]).optional().describe("\u79C1\u804A\u7B56\u7565"),
  groupPolicy: z.enum(["open", "allowlist", "disabled"]).optional().describe("\u7FA4\u804A\u7B56\u7565"),
  requireMention: z.boolean().optional().describe("\u7FA4\u804A\u662F\u5426\u9700\u8981 @\u673A\u5668\u4EBA \u624D\u54CD\u5E94"),
  groups: z.record(z.string(), WecomGroupSchema.optional()).optional().describe("\u7FA4\u804A\u914D\u7F6E")
}).describe("\u4F01\u4E1A\u5FAE\u4FE1\u8D26\u6237\u914D\u7F6E");
const WecomConfigSchema = z.object({
  enabled: z.boolean().optional().default(true).describe("\u662F\u5426\u542F\u7528"),
  app: WecomAppSchema.optional().describe("\u5E94\u7528\u914D\u7F6E (\u5355\u8D26\u6237\u6A21\u5F0F)"),
  webhookPath: z.string().optional().default("/wecom/webhook").describe("Webhook \u8DEF\u5F84"),
  allowFrom: z.array(z.string()).optional().describe("\u5141\u8BB8\u7684\u7528\u6237 ID \u5217\u8868 (\u79C1\u804A\u767D\u540D\u5355)"),
  groupAllowFrom: z.array(z.string()).optional().describe("\u5141\u8BB8\u7684\u7FA4 ID \u5217\u8868 (\u7FA4\u804A\u767D\u540D\u5355)"),
  dmPolicy: z.enum(["open", "allowlist", "pairing"]).optional().default("allowlist").describe("\u79C1\u804A\u7B56\u7565"),
  groupPolicy: z.enum(["open", "allowlist", "disabled"]).optional().default("allowlist").describe("\u7FA4\u804A\u7B56\u7565: open=\u6240\u6709\u7FA4, allowlist=\u767D\u540D\u5355\u7FA4, disabled=\u7981\u7528\u7FA4\u804A"),
  requireMention: z.boolean().optional().default(true).describe("\u7FA4\u804A\u662F\u5426\u9700\u8981 @\u673A\u5668\u4EBA \u624D\u54CD\u5E94"),
  groups: z.record(z.string(), WecomGroupSchema.optional()).optional().describe("\u7FA4\u804A\u914D\u7F6E (\u6309\u7FA4 ID \u5355\u72EC\u914D\u7F6E)"),
  // 多账户支持
  accounts: z.record(z.string(), WecomAccountSchema).optional().describe("\u591A\u8D26\u6237\u914D\u7F6E (accountId -> \u8D26\u6237\u914D\u7F6E)"),
  defaultAccount: z.string().optional().describe("\u9ED8\u8BA4\u8D26\u6237 ID (\u591A\u8D26\u6237\u6A21\u5F0F\u4E0B\u4F7F\u7528)")
}).describe("\u4F01\u4E1A\u5FAE\u4FE1\u6E20\u9053\u914D\u7F6E");
export {
  WecomConfigSchema
};
