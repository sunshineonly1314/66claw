import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { emptyPluginConfigSchema } from "clawdbot/plugin-sdk";

import { feishuPlugin } from "./src/channel.js";
import { setFeishuRuntime } from "./src/runtime.js";

const plugin = {
  id: "feishu",
  name: "飞书 (Feishu)",
  description: "飞书渠道插件 - 支持企业内部应用机器人",
  configSchema: emptyPluginConfigSchema(),
  register(api: ClawdbotPluginApi) {
    // 保存完整的 PluginRuntime 供 channel 使用
    setFeishuRuntime(api.runtime);
    api.registerChannel({ plugin: feishuPlugin });
    api.logger.info("[feishu] 飞书渠道插件已注册");
  },
};

export default plugin;
