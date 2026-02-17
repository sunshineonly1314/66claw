/**
 * 个人微信渠道 Onboarding 配置向导
 * WeChat Personal Channel Onboarding Adapter
 *
 * 引导用户完成 ClawChat 桥接服务配置
 */

import type {
  ChannelOnboardingAdapter,
  OpenClawCNConfig,
  WizardPrompter,
} from "openclawcn/plugin-sdk";
import { PLUGIN_ID, CHANNEL_ID, BRIDGE_URL } from "./constants.js";
import { getPluginConfig } from "./config.js";

const channel = CHANNEL_ID as "openclawwechat";

// ============================================================================
// 配置读写辅助函数
// ============================================================================

function getApiKeyFromConfig(cfg: OpenClawCNConfig): string | undefined {
  return getPluginConfig(cfg as any).apiKey;
}

function setPluginApiKey(
  cfg: OpenClawCNConfig,
  apiKey: string,
  enabled = true,
): OpenClawCNConfig {
  const existing = (cfg as any)?.plugins?.entries?.[PLUGIN_ID]?.config || {};
  return {
    ...cfg,
    plugins: {
      ...(cfg as any)?.plugins,
      entries: {
        ...(cfg as any)?.plugins?.entries,
        [PLUGIN_ID]: {
          ...(cfg as any)?.plugins?.entries?.[PLUGIN_ID],
          enabled,
          config: {
            ...existing,
            apiKey,
          },
        },
      },
    },
  } as OpenClawCNConfig;
}

function setPluginEnabled(
  cfg: OpenClawCNConfig,
  enabled: boolean,
): OpenClawCNConfig {
  return {
    ...cfg,
    plugins: {
      ...(cfg as any)?.plugins,
      entries: {
        ...(cfg as any)?.plugins?.entries,
        [PLUGIN_ID]: {
          ...(cfg as any)?.plugins?.entries?.[PLUGIN_ID],
          enabled,
        },
      },
    },
  } as OpenClawCNConfig;
}

// ============================================================================
// 配置向导提示
// ============================================================================

async function noteWechatSetup(prompter: WizardPrompter): Promise<void> {
  await prompter.note(
    [
      "=== 个人微信配置指南（通过 ClawChat 桥接）===",
      "",
      "ClawChat 会把别人发给你微信的消息转发给 AI，AI 处理完后自动回复。",
      "无需公网 IP，无需企业认证，无需翻墙，5 分钟即可完成。",
      "",
      "如果你还没有 ClawChat 的 API Key，请先完成以下准备：",
      "",
      "  1) 打开微信 → 搜索「ClawChat」→ 进入小程序 → 注册账号",
      "  2) 在小程序中按引导绑定你的个人微信号",
      "     （绑定的是你自己的号，微信照常使用，消息会额外转发给 AI）",
      "  3) 点击底部「我的」→「APIKey 管理」→「生成 APIKey」",
      "  4) 长按复制生成的 API Key",
      "",
      "API Key 长这样: 12345:abcdef1234567890",
      "                 ^^^^^ ^^^^^^^^^^^^^^^^",
      "                 bot_id    secret",
      "",
      "注意: 中间有个冒号(:)，请完整复制，不要漏掉！",
      "",
      "准备好了就在下一步粘贴你的 API Key。",
    ].join("\n"),
    "个人微信 API Key",
  );
}

async function noteWechatTestTip(prompter: WizardPrompter): Promise<void> {
  await prompter.note(
    [
      "=== 配置完成！来测试一下 ===",
      "",
      "  1) 在这个终端窗口里，输入下面的命令然后按回车，启动网关：",
      "",
      "     openclawcn gateway run",
      "",
      "  2) 网关启动后，用另一个微信号（朋友/家人/小号）",
      "     给你绑定的微信号发一条消息，比如发「你好」",
      "",
      "  3) 等待约 2 秒，如果收到 AI 自动回复，就成功了！",
      "",
      "没收到回复？按顺序排查：",
      "  · 回 ClawChat 小程序看看微信号绑定状态是否正常",
      "  · API Key 是否粘贴完整（必须包含冒号 :）",
      "  · 在终端输入 openclawcn gateway status 按回车，看网关状态",
      "  · 在终端输入 openclawcn logs --follow 按回车，查看日志找原因",
      "    （排查前先在配置中把 debug 改为 true）",
    ].join("\n"),
    "测试你的配置",
  );
}

// ============================================================================
// Onboarding Adapter
// ============================================================================

export const wechatMiniprogramOnboardingAdapter: ChannelOnboardingAdapter = {
  channel,

  getStatus: async ({ cfg }) => {
    const apiKey = getApiKeyFromConfig(cfg);
    const configured = Boolean(apiKey?.trim());
    return {
      channel,
      configured,
      statusLines: [
        `个人微信: ${configured ? "已配置" : "需要 ClawChat API Key"}`,
      ],
      selectionHint: configured
        ? "已配置 · 个人微信"
        : "个人微信 · 通过 ClawChat 桥接",
      quickstartScore: configured ? 2 : 5,
    };
  },

  configure: async ({ cfg, prompter }) => {
    let next = cfg;
    const existingKey = getApiKeyFromConfig(cfg);
    const alreadyConfigured = Boolean(existingKey?.trim());

    if (!alreadyConfigured) {
      // 首次配置：显示完整指南
      await noteWechatSetup(prompter);
    }

    // 已有 key 时询问是否保留
    if (alreadyConfigured) {
      const maskedKey = existingKey!.length > 8
        ? existingKey!.slice(0, 4) + "****" + existingKey!.slice(-4)
        : "****";

      const keep = await prompter.confirm({
        message: `个人微信 API Key 已配置 (${maskedKey})，保留当前配置？`,
        initialValue: true,
      });

      if (keep) {
        next = setPluginEnabled(next, true);
        return { cfg: next, accountId: "default" };
      }
    }

    // 输入新的 API Key
    const apiKey = String(
      await prompter.text({
        message: "请输入 ClawChat API Key (格式: bot_id:secret)",
        placeholder: "例如: 12345:abcdef1234567890",
        validate: (value) => {
          const raw = String(value ?? "").trim();
          if (!raw) return "API Key 不能为空";
          if (!raw.includes(":")) {
            return "API Key 格式应为 bot_id:secret（包含冒号）";
          }
          const [botId, secret] = raw.split(":");
          if (!botId?.trim() || !secret?.trim()) {
            return "bot_id 和 secret 都不能为空";
          }
          return undefined;
        },
      }),
    ).trim();

    next = setPluginApiKey(next, apiKey, true);

    // 询问是否需要调整轮询间隔
    const customPoll = await prompter.confirm({
      message: "使用默认轮询间隔 (2秒)？",
      initialValue: true,
    });

    if (!customPoll) {
      const pollMs = await prompter.text({
        message: "轮询间隔 (毫秒，建议 1000-10000)",
        placeholder: "2000",
        initialValue: "2000",
        validate: (value) => {
          const num = parseInt(String(value ?? ""), 10);
          if (isNaN(num) || num < 500) return "最少 500 毫秒";
          if (num > 30000) return "最多 30000 毫秒";
          return undefined;
        },
      });

      const existing =
        (next as any)?.plugins?.entries?.[PLUGIN_ID]?.config || {};
      next = {
        ...next,
        plugins: {
          ...(next as any)?.plugins,
          entries: {
            ...(next as any)?.plugins?.entries,
            [PLUGIN_ID]: {
              ...(next as any)?.plugins?.entries?.[PLUGIN_ID],
              config: {
                ...existing,
                pollIntervalMs: parseInt(String(pollMs), 10),
              },
            },
          },
        },
      } as OpenClawCNConfig;
    }

    // 显示测试提示
    await noteWechatTestTip(prompter);

    return { cfg: next, accountId: "default" };
  },

  disable: (cfg: OpenClawCNConfig) => setPluginEnabled(cfg, false),
};
