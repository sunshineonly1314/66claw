/**
 * 微信小程序渠道插件单元测试
 * WeChat MiniProgram Channel Plugin Unit Tests
 *
 * 测试覆盖:
 * - 插件 Meta 配置
 * - Target 归一化和识别
 * - outbound.resolveTarget
 * - config adapter (listAccountIds, resolveAccount, isConfigured)
 * - gateway.startAccount / stopAccount
 * - capabilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock runtime 避免实际初始化
const mockRuntime = {
  media: {
    loadWebMedia: vi.fn(),
    mediaKindFromMime: vi.fn(),
  },
};

vi.mock("./runtime.js", () => ({
  getWechatMiniprogramRuntime: () => mockRuntime,
}));

// Mock polling service
const mockStartPollingService = vi.fn().mockResolvedValue({
  running: true,
  lastStartAt: Date.now(),
  cleanup: vi.fn(),
});

vi.mock("./polling.js", () => ({
  startPollingService: (...args: any[]) => mockStartPollingService(...args),
}));

// Mock fetch for sendText/sendMedia
const mockFetch = vi.fn();

import { wechatMiniprogramPlugin } from "./channel.js";
import { CHANNEL_ID } from "./constants.js";

// ============================================================================
// 测试辅助函数 (Test Helpers)
// ============================================================================

function createPluginCfg(apiKey = "test-api-key") {
  return {
    plugins: {
      entries: {
        openclawwechat: {
          config: { apiKey },
        },
      },
    },
  } as any;
}

// ============================================================================
// Meta 配置测试
// ============================================================================

describe("wechatMiniprogramPlugin - Meta", () => {
  it("id 正确", () => {
    expect(wechatMiniprogramPlugin.id).toBe("openclawwechat");
  });

  it("meta 包含必要字段", () => {
    const meta = wechatMiniprogramPlugin.meta;
    expect(meta.id).toBe(CHANNEL_ID);
    expect(meta.label).toBe("微信 (WeChat)");
    expect(meta.docsPath).toBe("/channels/openclawwechat");
    expect(meta.aliases).toContain("wechat");
    expect(meta.aliases).toContain("wx");
    expect(meta.aliases).toContain("personal-wechat");
  });

  it("meta.aliases 是可变副本（不影响原始 const）", () => {
    const aliases = wechatMiniprogramPlugin.meta.aliases;
    expect(Array.isArray(aliases)).toBe(true);
  });
});

// ============================================================================
// Capabilities 测试
// ============================================================================

describe("wechatMiniprogramPlugin - Capabilities", () => {
  it("支持 direct 聊天类型", () => {
    expect(wechatMiniprogramPlugin.capabilities.chatTypes).toContain("direct");
  });

  it("支持媒体", () => {
    expect(wechatMiniprogramPlugin.capabilities.media).toBe(true);
  });

  it("启用 blockStreaming", () => {
    expect(wechatMiniprogramPlugin.capabilities.blockStreaming).toBe(true);
  });
});

// ============================================================================
// Config Adapter 测试
// ============================================================================

describe("wechatMiniprogramPlugin - Config", () => {
  it("listAccountIds 始终返回 ['default']", () => {
    const ids = wechatMiniprogramPlugin.config.listAccountIds({} as any);
    expect(ids).toEqual(["default"]);
  });

  it("resolveAccount 返回正确结构", () => {
    const cfg = createPluginCfg("my-key");
    const account = wechatMiniprogramPlugin.config.resolveAccount(cfg, "acct1");

    expect(account.accountId).toBe("acct1");
    expect(account.enabled).toBe(true);
    expect(account.config.apiKey).toBe("my-key");
  });

  it("resolveAccount 无 accountId 时使用 default", () => {
    const cfg = createPluginCfg("key");
    const account = wechatMiniprogramPlugin.config.resolveAccount(cfg, null);
    expect(account.accountId).toBe("default");
  });

  it("isConfigured 有 apiKey 返回 true", () => {
    const account = {
      accountId: "default",
      enabled: true,
      config: { apiKey: "valid-key" },
    };
    expect(wechatMiniprogramPlugin.config.isConfigured(account as any)).toBe(
      true,
    );
  });

  it("isConfigured 无 apiKey 返回 false", () => {
    const account = {
      accountId: "default",
      enabled: true,
      config: {},
    };
    expect(wechatMiniprogramPlugin.config.isConfigured(account as any)).toBe(
      false,
    );
  });

  it("describeAccount 返回摘要", () => {
    const account = {
      accountId: "prod",
      enabled: true,
      config: { apiKey: "key123" },
    };
    const desc = wechatMiniprogramPlugin.config.describeAccount(account as any);

    expect(desc.accountId).toBe("prod");
    expect(desc.enabled).toBe(true);
    expect(desc.configured).toBe(true);
  });
});

// ============================================================================
// Messaging - Target 归一化测试
// ============================================================================

describe("wechatMiniprogramPlugin - Messaging", () => {
  const normalize = wechatMiniprogramPlugin.messaging!.normalizeTarget!;
  const resolver = wechatMiniprogramPlugin.messaging!.targetResolver!;

  describe("normalizeTarget", () => {
    it("普通 openid 直接返回", () => {
      expect(normalize("oXYZ123456789abcdefgh")).toBe("oXYZ123456789abcdefgh");
    });

    it("channel:openid 格式提取 openid", () => {
      expect(normalize(`${CHANNEL_ID}:oXYZ123`)).toBe("oXYZ123");
    });

    it("空字符串返回 undefined", () => {
      expect(normalize("")).toBeUndefined();
    });

    it("仅空格返回 undefined", () => {
      expect(normalize("   ")).toBeUndefined();
    });

    it("channel: 后无内容时返回原始字符串", () => {
      // CHANNEL_ID: 后面为空，slice 结果为 ""，所以不走 channel: 分支
      // 最终返回 trimmed，即 "openclawwechat:"
      const result = normalize(`${CHANNEL_ID}:`);
      expect(result).toBe(`${CHANNEL_ID}:`);
    });

    it("前后空格被去除", () => {
      expect(normalize("  user123  ")).toBe("user123");
    });
  });

  describe("targetResolver.looksLikeId", () => {
    it("20+ 字符的字母数字串识别为 openid", () => {
      expect(resolver.looksLikeId("oXYZ123456789abcdefghij")).toBe(true);
    });

    it("短字符串不识别", () => {
      expect(resolver.looksLikeId("short")).toBe(false);
    });

    it("channel:openid 格式识别", () => {
      expect(resolver.looksLikeId(`${CHANNEL_ID}:oXYZ123`)).toBe(true);
    });

    it("空字符串不识别", () => {
      expect(resolver.looksLikeId("")).toBe(false);
    });

    it("包含特殊字符不识别（非字母数字下划线短横）", () => {
      expect(resolver.looksLikeId("user@domain.com.with.long")).toBe(false);
    });
  });
});

// ============================================================================
// Outbound - resolveTarget 测试
// ============================================================================

describe("wechatMiniprogramPlugin - Outbound resolveTarget", () => {
  const resolveTarget = wechatMiniprogramPlugin.outbound.resolveTarget;

  it("直接 openid 返回成功", () => {
    const result = resolveTarget({ to: "user_openid_123" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.to).toBe("user_openid_123");
  });

  it("channel:openid 格式提取 openid", () => {
    const result = resolveTarget({ to: `${CHANNEL_ID}:user_abc` });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.to).toBe("user_abc");
  });

  it("空 to 但有 allowFrom 时使用第一个", () => {
    const result = resolveTarget({
      to: "",
      allowFrom: [`${CHANNEL_ID}:fallback_user`],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.to).toBe("fallback_user");
  });

  it("空 to 且无 allowFrom 时返回错误", () => {
    const result = resolveTarget({ to: "" });
    expect(result.ok).toBe(false);
  });

  it("空 to 且 allowFrom 为空数组时返回错误", () => {
    const result = resolveTarget({ to: "", allowFrom: [] });
    expect(result.ok).toBe(false);
  });

  it("前后空格被去除", () => {
    const result = resolveTarget({ to: "  user123  " });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.to).toBe("user123");
  });
});

// ============================================================================
// Outbound - sendText 测试
// ============================================================================

describe("wechatMiniprogramPlugin - Outbound sendText", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("正常发送文本消息", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ ok: true, result: { message_id: 42 } }),
    });

    const result = await wechatMiniprogramPlugin.outbound.sendText({
      to: "user123",
      text: "你好",
      cfg: createPluginCfg("api-key:with:colons"),
    } as any);

    expect(result.channel).toBe(CHANNEL_ID);
    expect(result.messageId).toBe(42);

    // 验证 apiKey 被正确编码
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("api-key%3Awith%3Acolons");
    expect(calledUrl).not.toContain("api-key:with:colons/");
  });

  it("无 apiKey 时抛出错误", async () => {
    await expect(
      wechatMiniprogramPlugin.outbound.sendText({
        to: "user123",
        text: "test",
        cfg: createPluginCfg(""),
      } as any),
    ).rejects.toThrow("API Key not configured");
  });

  it("HTTP 错误时抛出异常", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Internal Server Error",
    });

    await expect(
      wechatMiniprogramPlugin.outbound.sendText({
        to: "user123",
        text: "test",
        cfg: createPluginCfg("valid-key"),
        log: { error: vi.fn() },
      } as any),
    ).rejects.toThrow("Failed to send message");
  });

  it("API 返回 ok=false 时抛出异常", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: false,
          description: "Bad Request: chat not found",
        }),
    });

    await expect(
      wechatMiniprogramPlugin.outbound.sendText({
        to: "user123",
        text: "test",
        cfg: createPluginCfg("valid-key"),
        log: { error: vi.fn() },
      } as any),
    ).rejects.toThrow("Bad Request: chat not found");
  });

  it("包含 replyToId 时正确传递", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { message_id: 1 } }),
    });

    await wechatMiniprogramPlugin.outbound.sendText({
      to: "user123",
      text: "reply",
      cfg: createPluginCfg("key"),
      replyToId: "999",
    } as any);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.reply_to_message_id).toBe(999);
    expect(body.chat_id).toBe("user123");
  });
});

// ============================================================================
// Gateway 测试
// ============================================================================

describe("wechatMiniprogramPlugin - Gateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("startAccount 调用 startPollingService", async () => {
    const ctx = {
      account: {
        accountId: "default",
        config: { apiKey: "valid-key" },
      },
      log: { info: vi.fn() },
    };

    await wechatMiniprogramPlugin.gateway.startAccount(ctx);
    expect(mockStartPollingService).toHaveBeenCalledWith(ctx);
  });

  it("startAccount 无 apiKey 时抛出错误", async () => {
    const ctx = {
      account: {
        accountId: "default",
        config: { apiKey: "" },
      },
      log: { info: vi.fn() },
    };

    await expect(
      wechatMiniprogramPlugin.gateway.startAccount(ctx),
    ).rejects.toThrow("API Key not configured");
  });

  it("stopAccount 设置状态", async () => {
    const setStatus = vi.fn();
    const ctx = {
      account: { accountId: "default" },
      log: { info: vi.fn() },
      setStatus,
    };

    await wechatMiniprogramPlugin.gateway.stopAccount(ctx);

    expect(setStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "default",
        running: false,
      }),
    );
  });
});

// ============================================================================
// Status 测试
// ============================================================================

describe("wechatMiniprogramPlugin - Status", () => {
  it("defaultRuntime 初始状态", () => {
    const defaultRt = wechatMiniprogramPlugin.status.defaultRuntime;
    expect(defaultRt.running).toBe(false);
    expect(defaultRt.lastError).toBeNull();
  });

  it("buildChannelSummary 处理空 snapshot", () => {
    const summary = wechatMiniprogramPlugin.status.buildChannelSummary({
      snapshot: {},
    });

    expect(summary.configured).toBe(false);
    expect(summary.running).toBe(false);
    expect(summary.lastError).toBeNull();
  });

  it("buildAccountSnapshot 包含正确字段", () => {
    const snap = wechatMiniprogramPlugin.status.buildAccountSnapshot({
      account: {
        accountId: "prod",
        enabled: true,
        config: { apiKey: "key" },
      },
      cfg: {},
      runtime: { running: true, lastStartAt: 1000 },
    });

    expect(snap.accountId).toBe("prod");
    expect(snap.running).toBe(true);
    expect(snap.lastStartAt).toBe(1000);
    expect(snap.configured).toBe(true);
  });
});
