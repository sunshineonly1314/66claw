/**
 * 钉钉引导式配置向导
 * DingTalk Onboarding Wizard
 *
 * 交互式 CLI 引导用户完成钉钉机器人配置。
 *
 * 流程:
 * 1. 展示钉钉开放平台创建应用引导
 * 2. 输入 AppKey / AppSecret
 * 3. 测试连接
 * 4. 选择接入模式 (Stream / Webhook)
 * 5. AI Card 开关 (Stream 模式)
 * 6. 配置私聊/群聊策略
 */

import {
  DEFAULT_ACCOUNT_ID,
  type ChannelOnboardingAdapter,
  type ChannelOnboardingDmPolicy,
  type OpenClawCNConfig,
  type DmPolicy,
} from "openclawcn/plugin-sdk";

import { probeDingtalkConnection } from "./api.js";
import type { DingtalkChannelConfig } from "./types.js";

const channel = "dingtalk" as const;

// ============================================================================
// Export
// ============================================================================

export const dingtalkOnboardingAdapter: ChannelOnboardingAdapter = {
  channel,

  // ===== Status =====
  getStatus: async (ctx) => {
    const channelConfig = ctx.cfg.channels?.dingtalk as DingtalkChannelConfig | undefined;
    const configured = Boolean(channelConfig?.app?.appKey && channelConfig?.app?.appSecret);
    const mode = channelConfig?.mode ?? "stream";

    return {
      channel,
      configured,
      statusLines: [
        configured
          ? `钉钉: 已配置 (${mode} 模式)`
          : "钉钉: 需要 AppKey/AppSecret",
      ],
      selectionHint: configured ? "已配置 - 推荐" : "中国企业 IM",
      quickstartScore: configured ? 1 : 5,
    };
  },

  // ===== Configure =====
  configure: async (ctx) => {
    const { cfg, prompter } = ctx;
    let next = { ...cfg };

    // Step 1: 帮助信息
    await prompter.note(
      [
        "1) 登录钉钉开放平台: https://open-dev.dingtalk.com/",
        "2) 创建企业内部应用 → 添加机器人能力",
        "3) 获取 AppKey (ClientID) 和 AppSecret (ClientSecret)",
        "4) (可选) 获取 RobotCode (用于批量发送)",
        "",
        "文档: https://open.dingtalk.com/document/orgapp/robot-overview",
      ].join("\n"),
      "钉钉机器人配置",
    );

    // Step 2: AppKey
    const appKey = await prompter.text({
      message: "钉钉 AppKey (ClientID)",
      initialValue: (next.channels?.dingtalk as DingtalkChannelConfig | undefined)?.app?.appKey,
      validate: (v: string) => (v?.trim() ? undefined : "AppKey 不能为空"),
    });

    // Step 3: AppSecret
    const appSecret = await prompter.text({
      message: "钉钉 AppSecret (ClientSecret)",
      initialValue: (next.channels?.dingtalk as DingtalkChannelConfig | undefined)?.app?.appSecret,
      validate: (v: string) => (v?.trim() ? undefined : "AppSecret 不能为空"),
    });

    // Step 4: 测试连接
    const probeConfig: DingtalkChannelConfig = {
      app: { appKey: appKey.trim(), appSecret: appSecret.trim() },
    };
    const probeResult = await probeDingtalkConnection(probeConfig);

    if (probeResult.ok) {
      await prompter.note("连接测试成功！Token 获取正常。", "连接成功");
    } else {
      await prompter.note(
        `连接测试失败: ${probeResult.error}\n请检查 AppKey 和 AppSecret 是否正确。\n你可以继续配置，稍后再验证。`,
        "连接失败",
      );
    }

    // Step 5: 接入模式
    const mode = await prompter.select({
      message: "接入模式",
      options: [
        { value: "stream", label: "Stream 模式 (推荐)", hint: "WebSocket, 无需公网 IP" },
        { value: "webhook", label: "Webhook 模式", hint: "HTTP POST, 需要公网 IP" },
      ],
      initialValue: "stream",
    });

    // Step 6: AI Card (Stream 模式)
    let enableAICard = true;
    if (mode === "stream") {
      enableAICard = await prompter.confirm({
        message: "启用 AI Card 流式响应? (打字机效果，需要应用权限)",
        initialValue: true,
      });
    }

    // Step 7: RobotCode (可选)
    const robotCode = await prompter.text({
      message: "RobotCode (可选，用于主动发送消息和媒体下载)",
      initialValue: (next.channels?.dingtalk as DingtalkChannelConfig | undefined)?.app?.robotCode,
      validate: () => undefined, // 可选
    });

    // Step 8: 私聊策略
    const dmPolicy = await prompter.select({
      message: "私聊策略",
      options: [
        { value: "pairing", label: "配对模式", hint: "推荐 - 新用户需审批" },
        { value: "allowlist", label: "白名单模式", hint: "仅允许指定用户" },
        { value: "open", label: "开放模式", hint: "所有人可用, 注意安全" },
      ],
      initialValue: "pairing",
    });

    // Step 9: 群聊策略
    const groupPolicy = await prompter.select({
      message: "群聊策略",
      options: [
        { value: "allowlist", label: "白名单模式", hint: "推荐 - 仅指定群可用" },
        { value: "open", label: "开放模式", hint: "所有群可用, 需 @机器人" },
      ],
      initialValue: "allowlist",
    });

    // 构建配置
    const dingtalkConfig: DingtalkChannelConfig = {
      enabled: true,
      mode: mode as "stream" | "webhook",
      app: {
        appKey: appKey.trim(),
        appSecret: appSecret.trim(),
        ...(robotCode?.trim() ? { robotCode: robotCode.trim() } : {}),
      },
      ...(mode === "stream"
        ? {
            stream: {
              enableAICard,
              enableMediaUpload: true,
            },
          }
        : {}),
      dmPolicy: dmPolicy as "open" | "allowlist" | "pairing",
      groupPolicy: groupPolicy as "open" | "allowlist",
    };

    next = {
      ...next,
      channels: {
        ...next.channels,
        dingtalk: dingtalkConfig,
      },
    } as OpenClawCNConfig;

    return { cfg: next, accountId: DEFAULT_ACCOUNT_ID };
  },

  // ===== DM Policy =====
  dmPolicy: {
    label: "钉钉",
    channel,
    policyKey: "channels.dingtalk.dmPolicy",
    allowFromKey: "channels.dingtalk.allowFrom",
    getCurrent: (cfg) =>
      ((cfg.channels?.dingtalk as DingtalkChannelConfig | undefined)?.dmPolicy ?? "pairing") as DmPolicy,
    setPolicy: (cfg, policy) => ({
      ...cfg,
      channels: {
        ...cfg.channels,
        dingtalk: {
          ...(cfg.channels?.dingtalk as DingtalkChannelConfig),
          dmPolicy: policy as "open" | "allowlist" | "pairing",
        },
      },
    }),
  },

  // ===== Disable =====
  disable: (cfg) => ({
    ...cfg,
    channels: {
      ...cfg.channels,
      dingtalk: {
        ...(cfg.channels?.dingtalk as DingtalkChannelConfig),
        enabled: false,
      },
    },
  }),
};
