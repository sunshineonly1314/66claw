import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { emptyPluginConfigSchema } from "clawdbot/plugin-sdk";

import { dingtalkPlugin } from "./src/channel.js";
import { setDingtalkRuntime } from "./src/runtime.js";

const plugin = {
  id: "dingtalk",
  name: "钉钉 (DingTalk)",
  description: "钉钉渠道插件 - 支持企业内部应用机器人",
  configSchema: emptyPluginConfigSchema(),
  register(api: ClawdbotPluginApi) {
    // 保存完整的 PluginRuntime 供 channel 使用
    setDingtalkRuntime(api.runtime);
    api.registerChannel({ plugin: dingtalkPlugin });
    api.logger.info("[dingtalk] 钉钉渠道插件已注册");
  },
};

export default plugin;
