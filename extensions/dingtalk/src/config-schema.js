import { z } from "zod";
const DingtalkAppSchema = z.object({
  appKey: z.string().optional().describe("\u9489\u9489\u5E94\u7528 AppKey"),
  appSecret: z.string().optional().describe("\u9489\u9489\u5E94\u7528 AppSecret"),
  robotCode: z.string().optional().describe("\u673A\u5668\u4EBA RobotCode (\u53EF\u9009)"),
  signSecret: z.string().optional().describe("\u6D88\u606F\u52A0\u7B7E\u5BC6\u94A5 (\u53EF\u9009)"),
  debug: z.boolean().optional().describe("\u8C03\u8BD5\u6A21\u5F0F")
}).strict();
const DingtalkStreamSchema = z.object({
  enableAICard: z.boolean().optional().default(true).describe("\u542F\u7528 AI Card \u6D41\u5F0F\u54CD\u5E94 (\u6253\u5B57\u673A\u6548\u679C)"),
  sessionTimeout: z.number().optional().default(18e5).describe("\u4F1A\u8BDD\u8D85\u65F6\u65F6\u95F4 (ms)\uFF0C\u9ED8\u8BA4 30 \u5206\u949F"),
  enableMediaUpload: z.boolean().optional().default(true).describe("\u542F\u7528\u56FE\u7247\u81EA\u52A8\u4E0A\u4F20"),
  systemPrompt: z.string().optional().describe("\u81EA\u5B9A\u4E49 system prompt"),
  gatewayToken: z.string().optional().describe("Gateway \u8BA4\u8BC1 token"),
  gatewayPassword: z.string().optional().describe("Gateway \u8BA4\u8BC1 password (\u4E0E token \u4E8C\u9009\u4E00)")
}).strict();
const DingtalkGroupSchema = z.object({
  requireMention: z.boolean().optional().describe("\u662F\u5426\u9700\u8981 @\u673A\u5668\u4EBA \u624D\u54CD\u5E94"),
  allowFrom: z.array(z.string()).optional().describe("\u5141\u8BB8\u7684\u53D1\u9001\u8005")
}).strict();
const DingtalkConfigSchema = z.object({
  enabled: z.boolean().optional().default(true).describe("\u662F\u5426\u542F\u7528"),
  mode: z.enum(["webhook", "stream"]).optional().default("stream").describe("\u63A5\u5165\u6A21\u5F0F: webhook \u6216 stream"),
  app: DingtalkAppSchema.optional().describe("\u5E94\u7528\u914D\u7F6E"),
  webhookPath: z.string().optional().default("/dingtalk/webhook").describe("Webhook \u8DEF\u5F84 (Webhook \u6A21\u5F0F\u4E13\u7528)"),
  stream: DingtalkStreamSchema.optional().describe("Stream \u6A21\u5F0F\u914D\u7F6E"),
  allowFrom: z.array(z.string()).optional().describe("\u5141\u8BB8\u7684\u7528\u6237 ID \u5217\u8868"),
  dmPolicy: z.enum(["open", "allowlist", "pairing"]).optional().default("pairing").describe("\u79C1\u804A\u7B56\u7565"),
  groupPolicy: z.enum(["open", "allowlist"]).optional().default("allowlist").describe("\u7FA4\u804A\u7B56\u7565"),
  groups: z.record(z.string(), DingtalkGroupSchema.optional()).optional().describe("\u7FA4\u804A\u914D\u7F6E")
}).strict();
export {
  DingtalkConfigSchema
};
