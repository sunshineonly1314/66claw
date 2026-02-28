import type { ClawdbotPluginApi } from "openclawcn/plugin-sdk";
import { emptyPluginConfigSchema } from "openclawcn/plugin-sdk";

import { feishuPlugin } from "./src/channel.js";
import { setFeishuRuntime } from "./src/runtime.js";
import { registerFeishuDocTools } from "./src/docx.js";
import { registerFeishuWikiTools } from "./src/wiki.js";
import { registerFeishuBitableTools } from "./src/bitable.js";
import { registerFeishuDriveTools } from "./src/drive.js";
import { registerFeishuTaskTools } from "./src/task-tools.js";

const plugin = {
  id: "feishu",
  name: "飞书 (Feishu)",
  description: "飞书渠道插件 - 支持企业内部应用机器人、文档、知识库、多维表格",
  configSchema: emptyPluginConfigSchema(),
  register(api: ClawdbotPluginApi) {
    // 保存完整的 PluginRuntime 供 channel 使用
    setFeishuRuntime(api.runtime);
    
    // 注册渠道
    api.registerChannel({ plugin: feishuPlugin });
    api.logger.info("[feishu] 飞书渠道插件已注册");
    
    // 注册飞书工具 (文档、知识库、多维表格、云空间、任务)
    // 这些工具让 AI 能够直接操作飞书生态
    try {
      registerFeishuDocTools(api);
      registerFeishuWikiTools(api);
      registerFeishuBitableTools(api);
      registerFeishuDriveTools(api);
      registerFeishuTaskTools(api);
    } catch (err) {
      api.logger.warn?.(`[feishu] 工具注册部分失败: ${err}`);
    }
  },
};

export default plugin;
