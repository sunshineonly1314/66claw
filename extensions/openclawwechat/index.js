import { emptyPluginConfigSchema } from "openclawcn/plugin-sdk";
import { wechatMiniprogramPlugin } from "./src/channel.js";
import { setWechatMiniprogramRuntime } from "./src/runtime.js";
const plugin = {
  id: "openclawwechat",
  name: "\u5FAE\u4FE1\u4E2A\u4EBA\u53F7 (WeChat Personal)",
  description: "\u4E2A\u4EBA\u5FAE\u4FE1\u6E20\u9053\u63D2\u4EF6 - \u901A\u8FC7 ClawChat \u6865\u63A5\u670D\u52A1\u63A5\u5165\uFF0C\u652F\u6301\u6587\u672C\u3001\u56FE\u7247\u3001\u89C6\u9891\u3001\u6587\u6863",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setWechatMiniprogramRuntime(api.runtime);
    api.registerChannel({ plugin: wechatMiniprogramPlugin });
    api.logger.info("[openclawwechat] \u4E2A\u4EBA\u5FAE\u4FE1\u6E20\u9053\u63D2\u4EF6\u5DF2\u6CE8\u518C");
  }
};
var openclawwechat_default = plugin;
export {
  openclawwechat_default as default
};
