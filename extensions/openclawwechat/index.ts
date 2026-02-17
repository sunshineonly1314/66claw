import type { ClawdbotPluginApi } from "openclawcn/plugin-sdk";
import { emptyPluginConfigSchema } from "openclawcn/plugin-sdk";

import { wechatMiniprogramPlugin } from "./src/channel.js";
import { setWechatMiniprogramRuntime } from "./src/runtime.js";

const plugin = {
  id: "openclawwechat",
  name: "微信个人号 (WeChat Personal)",
  description: "个人微信渠道插件 - 通过 ClawChat 桥接服务接入，支持文本、图片、视频、文档",
  configSchema: emptyPluginConfigSchema(),
  register(api: ClawdbotPluginApi) {
    setWechatMiniprogramRuntime(api.runtime);
    api.registerChannel({ plugin: wechatMiniprogramPlugin });
    api.logger.info("[openclawwechat] 个人微信渠道插件已注册");
  },
};

export default plugin;
