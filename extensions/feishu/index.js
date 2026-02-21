import { emptyPluginConfigSchema } from "openclawcn/plugin-sdk";
import { feishuPlugin } from "./src/channel.js";
import { setFeishuRuntime } from "./src/runtime.js";
import { registerFeishuDocTools } from "./src/docx.js";
import { registerFeishuWikiTools } from "./src/wiki.js";
import { registerFeishuBitableTools } from "./src/bitable.js";
import { registerFeishuDriveTools } from "./src/drive.js";
const plugin = {
  id: "feishu",
  name: "\u98DE\u4E66 (Feishu)",
  description: "\u98DE\u4E66\u6E20\u9053\u63D2\u4EF6 - \u652F\u6301\u4F01\u4E1A\u5185\u90E8\u5E94\u7528\u673A\u5668\u4EBA\u3001\u6587\u6863\u3001\u77E5\u8BC6\u5E93\u3001\u591A\u7EF4\u8868\u683C",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setFeishuRuntime(api.runtime);
    api.registerChannel({ plugin: feishuPlugin });
    api.logger.info("[feishu] \u98DE\u4E66\u6E20\u9053\u63D2\u4EF6\u5DF2\u6CE8\u518C");
    try {
      registerFeishuDocTools(api);
      registerFeishuWikiTools(api);
      registerFeishuBitableTools(api);
      registerFeishuDriveTools(api);
    } catch (err) {
      api.logger.warn?.(`[feishu] \u5DE5\u5177\u6CE8\u518C\u90E8\u5206\u5931\u8D25: ${err}`);
    }
  }
};
var feishu_default = plugin;
export {
  feishu_default as default
};
