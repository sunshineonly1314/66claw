import { z } from "zod";
const QqbotAppSchema = z.object({
  appId: z.string().optional().describe("QQ \u673A\u5668\u4EBA AppID"),
  appSecret: z.string().optional().describe("QQ \u673A\u5668\u4EBA AppSecret (ClientSecret)"),
  token: z.string().optional().describe("QQ \u673A\u5668\u4EBA Token (\u7528\u4E8E\u9A8C\u8BC1\u56DE\u8C03)"),
  publicKey: z.string().optional().describe("QQ \u673A\u5668\u4EBA\u516C\u94A5 (\u7528\u4E8E Ed25519 \u7B7E\u540D\u9A8C\u8BC1\uFF0Chex \u683C\u5F0F)")
}).strict();
const QqbotGroupSchema = z.object({
  requireMention: z.boolean().optional().describe("\u662F\u5426\u9700\u8981 @\u673A\u5668\u4EBA \u624D\u54CD\u5E94"),
  allowFrom: z.array(z.string()).optional().describe("\u5141\u8BB8\u7684\u53D1\u9001\u8005")
}).strict();
const QqbotConfigSchema = z.object({
  enabled: z.boolean().optional().default(true).describe("\u662F\u5426\u542F\u7528"),
  sandbox: z.boolean().optional().default(false).describe("\u662F\u5426\u4F7F\u7528\u6C99\u7BB1\u73AF\u5883"),
  app: QqbotAppSchema.optional().describe("\u5E94\u7528\u914D\u7F6E"),
  webhookPath: z.string().optional().default("/qqbot/webhook").describe("Webhook \u8DEF\u5F84"),
  allowFrom: z.array(z.string()).optional().describe("\u5141\u8BB8\u7684\u7528\u6237 ID \u5217\u8868"),
  dmPolicy: z.enum(["open", "allowlist", "pairing"]).optional().default("pairing").describe("\u79C1\u804A\u7B56\u7565"),
  groupPolicy: z.enum(["open", "allowlist"]).optional().default("allowlist").describe("\u7FA4\u804A\u7B56\u7565"),
  groups: z.record(z.string(), QqbotGroupSchema.optional()).optional().describe("\u7FA4\u804A\u914D\u7F6E")
}).strict();
export {
  QqbotConfigSchema
};
