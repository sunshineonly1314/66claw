import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { emptyPluginConfigSchema } from "clawdbot/plugin-sdk";

import { qqbotPlugin } from "./src/channel.js";
import { setQqbotRuntime } from "./src/runtime.js";

const plugin = {
  id: "qqbot",
  name: "QQ 机器人 (QQ Bot)",
  description: "QQ 机器人渠道插件 - 支持 QQ 开放平台机器人",
  configSchema: emptyPluginConfigSchema(),
  register(api: ClawdbotPluginApi) {
    // 保存完整的 PluginRuntime 供 channel 使用
    setQqbotRuntime(api.runtime);
    api.registerChannel({ plugin: qqbotPlugin });
    api.logger.info("[qqbot] QQ 机器人渠道插件已注册");
  },
};

export default plugin;
