import { emptyPluginConfigSchema } from "openclawcn/plugin-sdk";
import { dingtalkPlugin } from "./src/channel.js";
import { setDingtalkRuntime } from "./src/runtime.js";
const plugin = {
  id: "dingtalk",
  name: "\u9489\u9489 (DingTalk)",
  description: "\u9489\u9489\u6E20\u9053\u63D2\u4EF6 - \u652F\u6301\u4F01\u4E1A\u5185\u90E8\u5E94\u7528\u673A\u5668\u4EBA",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setDingtalkRuntime(api.runtime);
    api.registerChannel({ plugin: dingtalkPlugin });
    api.logger.info("[dingtalk] \u9489\u9489\u6E20\u9053\u63D2\u4EF6\u5DF2\u6CE8\u518C");
  }
};
var dingtalk_default = plugin;
export {
  dingtalk_default as default
};
