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
      "=== 个人微信 (ClawChat) 配置指南 ===",
      "",
      "【第一部分：上游 ClawChat 桥接服务配置】",
      "",
      "  步骤 1) 在微信中搜索「ClawChat」小程序，注册账号",
      "  步骤 2) 按引导绑定你的个人微信号",
      "         绑定后你的微信收到的消息会被转发到桥接服务器",
      "  步骤 3) 进入 ClawChat →「我的」→「APIKey 管理」",
      "         点击「生成 APIKey」，复制生成的 Key",
      "",
      "【第二部分：OpenClawCN 端配置】",
      "",
      "  步骤 4) 在下一步中粘贴你的 ClawChat API Key",
      "  步骤 5) 启动网关后发送微信消息测试",
      "",
      "API Key 格式: bot_id:secret (包含冒号，请完整复制)",
      "",
      "工作原理：",
      "  个人微信消息 → ClawChat 桥接服务器 → OpenClawCN AI → 回复到微信",
      "  无需 VPN，无需企业认证，支持文本/图片/视频/文档",
      "",
      `桥接服务器: ${BRIDGE_URL}`,
    ].join("\n"),
    "个人微信 API Key",
  );
}

async function noteWechatTestTip(prompter: WizardPrompter): Promise<void> {
  await prompter.note(
    [
      "=== 验证配置 ===",
      "",
      "  1) 启动 OpenClawCN 网关: openclawcn gateway run",
      "  2) 在微信中给绑定的个人号发送一条消息（例如「你好」）",
      "  3) 约 2 秒内即可收到 AI 回复",
      "",
      "  排查步骤（如果没有收到回复）：",
      "  · 确认 ClawChat 中微信号绑定状态正常",
      "  · 检查 API Key 是否正确: openclawcn config show",
      "  · 开启调试日志: 设置 debug: true",
      "  · 查看日志: openclawcn logs --follow",
      "  · 检查网络: curl https://api.clawchat.mifengcdn.com",
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
