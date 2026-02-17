/**
 * 配置模块单元测试
 * Config Module Unit Tests
 *
 * 测试覆盖:
 * - getPluginConfig 配置读取
 * - isConfigValid 配置验证
 * - 默认值回退
 * - 旧配置兼容 (sessionKeyPrefix → sessionKey)
 */

import { describe, it, expect } from "vitest";
import { getPluginConfig, isConfigValid } from "./config.js";
import { DEFAULT_CONFIG, BRIDGE_URL, PLUGIN_ID } from "./constants.js";

// ============================================================================
// 测试辅助函数 (Test Helpers)
// ============================================================================

function createPluginCfg(overrides?: Record<string, unknown>) {
  return {
    plugins: {
      entries: {
        [PLUGIN_ID]: {
          config: {
            apiKey: "test-api-key-12345",
            ...overrides,
          },
        },
      },
    },
  } as any;
}

// ============================================================================
// getPluginConfig 测试
// ============================================================================

describe("getPluginConfig", () => {
  it("从完整配置中正确读取所有字段", () => {
    const cfg = createPluginCfg({
      apiKey: "my-key",
      pollIntervalMs: 5000,
      sessionKey: "agent:custom:session",
      debug: true,
    });

    const result = getPluginConfig(cfg);

    expect(result.apiKey).toBe("my-key");
    expect(result.pollIntervalMs).toBe(5000);
    expect(result.sessionKey).toBe("agent:custom:session");
    expect(result.debug).toBe(true);
    expect(result.bridgeUrl).toBe(BRIDGE_URL);
  });

  it("缺少字段时使用默认值", () => {
    const cfg = createPluginCfg({ apiKey: "key-only" });

    const result = getPluginConfig(cfg);

    expect(result.apiKey).toBe("key-only");
    expect(result.pollIntervalMs).toBe(DEFAULT_CONFIG.pollIntervalMs);
    expect(result.sessionKey).toBe(DEFAULT_CONFIG.sessionKey);
    expect(result.debug).toBe(DEFAULT_CONFIG.debug);
  });

  it("cfg 为 undefined 时返回全部默认值", () => {
    const result = getPluginConfig(undefined);

    expect(result.apiKey).toBeUndefined();
    expect(result.pollIntervalMs).toBe(DEFAULT_CONFIG.pollIntervalMs);
    expect(result.sessionKey).toBe(DEFAULT_CONFIG.sessionKey);
    expect(result.debug).toBe(false);
    expect(result.bridgeUrl).toBe(BRIDGE_URL);
  });

  it("cfg 为空对象时返回全部默认值", () => {
    const result = getPluginConfig({} as any);

    expect(result.apiKey).toBeUndefined();
    expect(result.pollIntervalMs).toBe(DEFAULT_CONFIG.pollIntervalMs);
  });

  it("兼容旧配置 sessionKeyPrefix", () => {
    const cfg = createPluginCfg({
      sessionKeyPrefix: "agent:legacy:session",
    });

    const result = getPluginConfig(cfg);
    expect(result.sessionKey).toBe("agent:legacy:session");
  });

  it("sessionKey 优先于 sessionKeyPrefix", () => {
    const cfg = createPluginCfg({
      sessionKey: "agent:new:session",
      sessionKeyPrefix: "agent:old:session",
    });

    const result = getPluginConfig(cfg);
    expect(result.sessionKey).toBe("agent:new:session");
  });

  it("bridgeUrl 始终使用常量值", () => {
    const result = getPluginConfig(undefined);
    expect(result.bridgeUrl).toBe("https://api.clawchat.mifengcdn.com");
  });
});

// ============================================================================
// isConfigValid 测试
// ============================================================================

describe("isConfigValid", () => {
  it("有 apiKey 时返回 true", () => {
    expect(
      isConfigValid({
        bridgeUrl: BRIDGE_URL,
        apiKey: "valid-key",
        pollIntervalMs: 2000,
        sessionKey: "agent:main:main",
        debug: false,
      }),
    ).toBe(true);
  });

  it("apiKey 为空字符串时返回 false", () => {
    expect(
      isConfigValid({
        bridgeUrl: BRIDGE_URL,
        apiKey: "",
        pollIntervalMs: 2000,
        sessionKey: "agent:main:main",
        debug: false,
      }),
    ).toBe(false);
  });

  it("apiKey 仅空格时返回 false", () => {
    expect(
      isConfigValid({
        bridgeUrl: BRIDGE_URL,
        apiKey: "   ",
        pollIntervalMs: 2000,
        sessionKey: "agent:main:main",
        debug: false,
      }),
    ).toBe(false);
  });

  it("apiKey 为 undefined 时返回 false", () => {
    expect(
      isConfigValid({
        bridgeUrl: BRIDGE_URL,
        apiKey: undefined,
        pollIntervalMs: 2000,
        sessionKey: "agent:main:main",
        debug: false,
      }),
    ).toBe(false);
  });
});
