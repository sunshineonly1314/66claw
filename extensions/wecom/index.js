import { emptyPluginConfigSchema } from "openclawcn/plugin-sdk";
import { wecomPlugin } from "./src/channel.js";
import { setWecomRuntime } from "./src/runtime.js";
const plugin = {
  id: "wecom",
  name: "\u4F01\u4E1A\u5FAE\u4FE1 (WeCom)",
  description: "\u4F01\u4E1A\u5FAE\u4FE1\u6E20\u9053\u63D2\u4EF6 - \u652F\u6301\u81EA\u5EFA\u5E94\u7528\u6D88\u606F",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setWecomRuntime(api.runtime);
    api.registerChannel({ plugin: wecomPlugin });
    api.logger.info("[wecom] \u4F01\u4E1A\u5FAE\u4FE1\u6E20\u9053\u63D2\u4EF6\u5DF2\u6CE8\u518C");
  }
};
var wecom_default = plugin;
export {
  wecom_default as default
};
