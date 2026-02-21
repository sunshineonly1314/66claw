import { z } from "zod";
const WechatMiniprogramConfigSchema = z.object({
  enabled: z.boolean().optional().default(true).describe("\u662F\u5426\u542F\u7528\u4E2A\u4EBA\u5FAE\u4FE1\u6E20\u9053"),
  apiKey: z.string().optional().describe("ClawChat API Key (\u683C\u5F0F: bot_id:secret\uFF0C\u5728 ClawChat \u4E2D\u83B7\u53D6)"),
  pollIntervalMs: z.number().int().positive().optional().default(2e3).describe("\u8F6E\u8BE2\u95F4\u9694 (\u6BEB\u79D2)\uFF0C\u9ED8\u8BA4 2000ms"),
  sessionKey: z.string().optional().default("agent:main:main").describe("\u4F1A\u8BDD\u6807\u8BC6 (\u683C\u5F0F: agent:<agentId>:<rest>)"),
  debug: z.boolean().optional().default(false).describe("\u8C03\u8BD5\u6A21\u5F0F\uFF0C\u542F\u7528\u8BE6\u7EC6\u65E5\u5FD7")
}).describe("\u4E2A\u4EBA\u5FAE\u4FE1\u6E20\u9053\u914D\u7F6E (\u901A\u8FC7 ClawChat \u6865\u63A5)");
export {
  WechatMiniprogramConfigSchema
};
