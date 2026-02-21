import { PLUGIN_ID, CHANNEL_ID } from "./constants.js";
import { getPluginConfig } from "./config.js";
const channel = CHANNEL_ID;
function getApiKeyFromConfig(cfg) {
  return getPluginConfig(cfg).apiKey;
}
function setPluginApiKey(cfg, apiKey, enabled = true) {
  const existing = cfg?.plugins?.entries?.[PLUGIN_ID]?.config || {};
  return {
    ...cfg,
    plugins: {
      ...cfg?.plugins,
      entries: {
        ...cfg?.plugins?.entries,
        [PLUGIN_ID]: {
          ...cfg?.plugins?.entries?.[PLUGIN_ID],
          enabled,
          config: {
            ...existing,
            apiKey
          }
        }
      }
    }
  };
}
function setPluginEnabled(cfg, enabled) {
  return {
    ...cfg,
    plugins: {
      ...cfg?.plugins,
      entries: {
        ...cfg?.plugins?.entries,
        [PLUGIN_ID]: {
          ...cfg?.plugins?.entries?.[PLUGIN_ID],
          enabled
        }
      }
    }
  };
}
async function noteWechatSetup(prompter) {
  await prompter.note(
    [
      "=== \u4E2A\u4EBA\u5FAE\u4FE1\u914D\u7F6E\u6307\u5357\uFF08\u901A\u8FC7 ClawChat \u6865\u63A5\uFF09===",
      "",
      "ClawChat \u4F1A\u628A\u522B\u4EBA\u53D1\u7ED9\u4F60\u5FAE\u4FE1\u7684\u6D88\u606F\u8F6C\u53D1\u7ED9 AI\uFF0CAI \u5904\u7406\u5B8C\u540E\u81EA\u52A8\u56DE\u590D\u3002",
      "\u65E0\u9700\u516C\u7F51 IP\uFF0C\u65E0\u9700\u4F01\u4E1A\u8BA4\u8BC1\uFF0C\u65E0\u9700\u7FFB\u5899\uFF0C5 \u5206\u949F\u5373\u53EF\u5B8C\u6210\u3002",
      "",
      "\u5982\u679C\u4F60\u8FD8\u6CA1\u6709 ClawChat \u7684 API Key\uFF0C\u8BF7\u5148\u5B8C\u6210\u4EE5\u4E0B\u51C6\u5907\uFF1A",
      "",
      "  1) \u6253\u5F00\u5FAE\u4FE1 \u2192 \u641C\u7D22\u300CClawChat\u300D\u2192 \u8FDB\u5165\u5C0F\u7A0B\u5E8F \u2192 \u6CE8\u518C\u8D26\u53F7",
      "  2) \u5728\u5C0F\u7A0B\u5E8F\u4E2D\u6309\u5F15\u5BFC\u7ED1\u5B9A\u4F60\u7684\u4E2A\u4EBA\u5FAE\u4FE1\u53F7",
      "     \uFF08\u7ED1\u5B9A\u7684\u662F\u4F60\u81EA\u5DF1\u7684\u53F7\uFF0C\u5FAE\u4FE1\u7167\u5E38\u4F7F\u7528\uFF0C\u6D88\u606F\u4F1A\u989D\u5916\u8F6C\u53D1\u7ED9 AI\uFF09",
      "  3) \u70B9\u51FB\u5E95\u90E8\u300C\u6211\u7684\u300D\u2192\u300CAPIKey \u7BA1\u7406\u300D\u2192\u300C\u751F\u6210 APIKey\u300D",
      "  4) \u957F\u6309\u590D\u5236\u751F\u6210\u7684 API Key",
      "",
      "API Key \u957F\u8FD9\u6837: 12345:abcdef1234567890",
      "                 ^^^^^ ^^^^^^^^^^^^^^^^",
      "                 bot_id    secret",
      "",
      "\u6CE8\u610F: \u4E2D\u95F4\u6709\u4E2A\u5192\u53F7(:)\uFF0C\u8BF7\u5B8C\u6574\u590D\u5236\uFF0C\u4E0D\u8981\u6F0F\u6389\uFF01",
      "",
      "\u51C6\u5907\u597D\u4E86\u5C31\u5728\u4E0B\u4E00\u6B65\u7C98\u8D34\u4F60\u7684 API Key\u3002"
    ].join("\n"),
    "\u4E2A\u4EBA\u5FAE\u4FE1 API Key"
  );
}
async function noteWechatTestTip(prompter) {
  await prompter.note(
    [
      "=== \u914D\u7F6E\u5B8C\u6210\uFF01\u6765\u6D4B\u8BD5\u4E00\u4E0B ===",
      "",
      "  1) \u5728\u8FD9\u4E2A\u7EC8\u7AEF\u7A97\u53E3\u91CC\uFF0C\u8F93\u5165\u4E0B\u9762\u7684\u547D\u4EE4\u7136\u540E\u6309\u56DE\u8F66\uFF0C\u542F\u52A8\u7F51\u5173\uFF1A",
      "",
      "     openclawcn gateway run",
      "",
      "  2) \u7F51\u5173\u542F\u52A8\u540E\uFF0C\u7528\u53E6\u4E00\u4E2A\u5FAE\u4FE1\u53F7\uFF08\u670B\u53CB/\u5BB6\u4EBA/\u5C0F\u53F7\uFF09",
      "     \u7ED9\u4F60\u7ED1\u5B9A\u7684\u5FAE\u4FE1\u53F7\u53D1\u4E00\u6761\u6D88\u606F\uFF0C\u6BD4\u5982\u53D1\u300C\u4F60\u597D\u300D",
      "",
      "  3) \u7B49\u5F85\u7EA6 2 \u79D2\uFF0C\u5982\u679C\u6536\u5230 AI \u81EA\u52A8\u56DE\u590D\uFF0C\u5C31\u6210\u529F\u4E86\uFF01",
      "",
      "\u6CA1\u6536\u5230\u56DE\u590D\uFF1F\u6309\u987A\u5E8F\u6392\u67E5\uFF1A",
      "  \xB7 \u56DE ClawChat \u5C0F\u7A0B\u5E8F\u770B\u770B\u5FAE\u4FE1\u53F7\u7ED1\u5B9A\u72B6\u6001\u662F\u5426\u6B63\u5E38",
      "  \xB7 API Key \u662F\u5426\u7C98\u8D34\u5B8C\u6574\uFF08\u5FC5\u987B\u5305\u542B\u5192\u53F7 :\uFF09",
      "  \xB7 \u5728\u7EC8\u7AEF\u8F93\u5165 openclawcn gateway status \u6309\u56DE\u8F66\uFF0C\u770B\u7F51\u5173\u72B6\u6001",
      "  \xB7 \u5728\u7EC8\u7AEF\u8F93\u5165 openclawcn logs --follow \u6309\u56DE\u8F66\uFF0C\u67E5\u770B\u65E5\u5FD7\u627E\u539F\u56E0",
      "    \uFF08\u6392\u67E5\u524D\u5148\u5728\u914D\u7F6E\u4E2D\u628A debug \u6539\u4E3A true\uFF09"
    ].join("\n"),
    "\u6D4B\u8BD5\u4F60\u7684\u914D\u7F6E"
  );
}
const wechatMiniprogramOnboardingAdapter = {
  channel,
  getStatus: async ({ cfg }) => {
    const apiKey = getApiKeyFromConfig(cfg);
    const configured = Boolean(apiKey?.trim());
    return {
      channel,
      configured,
      statusLines: [
        `\u4E2A\u4EBA\u5FAE\u4FE1: ${configured ? "\u5DF2\u914D\u7F6E" : "\u9700\u8981 ClawChat API Key"}`
      ],
      selectionHint: configured ? "\u5DF2\u914D\u7F6E \xB7 \u4E2A\u4EBA\u5FAE\u4FE1" : "\u4E2A\u4EBA\u5FAE\u4FE1 \xB7 \u901A\u8FC7 ClawChat \u6865\u63A5",
      quickstartScore: configured ? 2 : 5
    };
  },
  configure: async ({ cfg, prompter }) => {
    let next = cfg;
    const existingKey = getApiKeyFromConfig(cfg);
    const alreadyConfigured = Boolean(existingKey?.trim());
    if (!alreadyConfigured) {
      await noteWechatSetup(prompter);
    }
    if (alreadyConfigured) {
      const maskedKey = existingKey.length > 8 ? existingKey.slice(0, 4) + "****" + existingKey.slice(-4) : "****";
      const keep = await prompter.confirm({
        message: `\u4E2A\u4EBA\u5FAE\u4FE1 API Key \u5DF2\u914D\u7F6E (${maskedKey})\uFF0C\u4FDD\u7559\u5F53\u524D\u914D\u7F6E\uFF1F`,
        initialValue: true
      });
      if (keep) {
        next = setPluginEnabled(next, true);
        return { cfg: next, accountId: "default" };
      }
    }
    const apiKey = String(
      await prompter.text({
        message: "\u8BF7\u8F93\u5165 ClawChat API Key (\u683C\u5F0F: bot_id:secret)",
        placeholder: "\u4F8B\u5982: 12345:abcdef1234567890",
        validate: (value) => {
          const raw = String(value ?? "").trim();
          if (!raw) return "API Key \u4E0D\u80FD\u4E3A\u7A7A";
          if (!raw.includes(":")) {
            return "API Key \u683C\u5F0F\u5E94\u4E3A bot_id:secret\uFF08\u5305\u542B\u5192\u53F7\uFF09";
          }
          const [botId, secret] = raw.split(":");
          if (!botId?.trim() || !secret?.trim()) {
            return "bot_id \u548C secret \u90FD\u4E0D\u80FD\u4E3A\u7A7A";
          }
          return void 0;
        }
      })
    ).trim();
    next = setPluginApiKey(next, apiKey, true);
    const customPoll = await prompter.confirm({
      message: "\u4F7F\u7528\u9ED8\u8BA4\u8F6E\u8BE2\u95F4\u9694 (2\u79D2)\uFF1F",
      initialValue: true
    });
    if (!customPoll) {
      const pollMs = await prompter.text({
        message: "\u8F6E\u8BE2\u95F4\u9694 (\u6BEB\u79D2\uFF0C\u5EFA\u8BAE 1000-10000)",
        placeholder: "2000",
        initialValue: "2000",
        validate: (value) => {
          const num = parseInt(String(value ?? ""), 10);
          if (isNaN(num) || num < 500) return "\u6700\u5C11 500 \u6BEB\u79D2";
          if (num > 3e4) return "\u6700\u591A 30000 \u6BEB\u79D2";
          return void 0;
        }
      });
      const existing = next?.plugins?.entries?.[PLUGIN_ID]?.config || {};
      next = {
        ...next,
        plugins: {
          ...next?.plugins,
          entries: {
            ...next?.plugins?.entries,
            [PLUGIN_ID]: {
              ...next?.plugins?.entries?.[PLUGIN_ID],
              config: {
                ...existing,
                pollIntervalMs: parseInt(String(pollMs), 10)
              }
            }
          }
        }
      };
    }
    await noteWechatTestTip(prompter);
    return { cfg: next, accountId: "default" };
  },
  disable: (cfg) => setPluginEnabled(cfg, false)
};
export {
  wechatMiniprogramOnboardingAdapter
};
