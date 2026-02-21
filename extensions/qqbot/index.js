import { emptyPluginConfigSchema } from "openclawcn/plugin-sdk";
import { qqbotPlugin } from "./src/channel.js";
import { setQqbotRuntime } from "./src/runtime.js";
const plugin = {
  id: "qqbot",
  name: "QQ \u673A\u5668\u4EBA (QQ Bot)",
  description: "QQ \u673A\u5668\u4EBA\u6E20\u9053\u63D2\u4EF6 - \u652F\u6301 QQ \u5F00\u653E\u5E73\u53F0\u673A\u5668\u4EBA",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setQqbotRuntime(api.runtime);
    api.registerChannel({ plugin: qqbotPlugin });
    api.logger.info("[qqbot] QQ \u673A\u5668\u4EBA\u6E20\u9053\u63D2\u4EF6\u5DF2\u6CE8\u518C");
  }
};
var qqbot_default = plugin;
export {
  qqbot_default as default
};
