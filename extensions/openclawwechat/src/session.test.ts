/**
 * Session 管理模块单元测试
 * Session Module Unit Tests
 *
 * 测试覆盖:
 * - resolveSession 会话解析
 * - sessionKey 格式验证 (agent:<agentId>:<rest>)
 * - agentId 提取
 * - 无效 sessionKey 回退到默认值
 */

import { describe, it, expect } from "vitest";
import { resolveSession } from "./session.js";
import { DEFAULT_CONFIG, PLUGIN_ID } from "./constants.js";

// ============================================================================
// 测试辅助函数 (Test Helpers)
// ============================================================================

function createCfgWithSessionKey(sessionKey?: string) {
  return {
    plugins: {
      entries: {
        [PLUGIN_ID]: {
          config: {
            apiKey: "test-key",
            ...(sessionKey !== undefined ? { sessionKey } : {}),
          },
        },
      },
    },
  } as any;
}

// ============================================================================
// resolveSession 测试
// ============================================================================

describe("resolveSession", () => {
  it("使用有效的 sessionKey", () => {
    const result = resolveSession({
      cfg: createCfgWithSessionKey("agent:mybot:main"),
      apiKey: "test-key",
      accountId: "default",
      openid: "user123",
    });

    expect(result.sessionKey).toBe("agent:mybot:main");
    expect(result.agentId).toBe("mybot");
    expect(result.mainSessionKey).toBe("agent:mybot:main");
    expect(result.fromRoute).toBe(false);
  });

  it("使用默认 sessionKey (agent:main:main)", () => {
    const result = resolveSession({
      cfg: createCfgWithSessionKey(),
      apiKey: "test-key",
      accountId: "default",
      openid: "user123",
    });

    expect(result.sessionKey).toBe(DEFAULT_CONFIG.sessionKey);
    expect(result.agentId).toBe("main");
  });

  it("无效 sessionKey 格式回退到默认值 - 只有1段", () => {
    const result = resolveSession({
      cfg: createCfgWithSessionKey("invalid"),
      apiKey: "test-key",
      accountId: "default",
      openid: "user123",
    });

    expect(result.sessionKey).toBe(DEFAULT_CONFIG.sessionKey);
  });

  it("无效 sessionKey 格式回退到默认值 - 只有2段", () => {
    const result = resolveSession({
      cfg: createCfgWithSessionKey("agent:mybot"),
      apiKey: "test-key",
      accountId: "default",
      openid: "user123",
    });

    expect(result.sessionKey).toBe(DEFAULT_CONFIG.sessionKey);
  });

  it("无效 sessionKey 格式回退到默认值 - 不以 agent: 开头", () => {
    const result = resolveSession({
      cfg: createCfgWithSessionKey("session:bot:main"),
      apiKey: "test-key",
      accountId: "default",
      openid: "user123",
    });

    expect(result.sessionKey).toBe(DEFAULT_CONFIG.sessionKey);
  });

  it("空字符串 sessionKey 回退到默认值", () => {
    const result = resolveSession({
      cfg: createCfgWithSessionKey(""),
      apiKey: "test-key",
      accountId: "default",
      openid: "user123",
    });

    expect(result.sessionKey).toBe(DEFAULT_CONFIG.sessionKey);
  });

  it("仅空格 sessionKey 回退到默认值", () => {
    const result = resolveSession({
      cfg: createCfgWithSessionKey("   "),
      apiKey: "test-key",
      accountId: "default",
      openid: "user123",
    });

    expect(result.sessionKey).toBe(DEFAULT_CONFIG.sessionKey);
  });

  it("多段 sessionKey (>3) 也能正确解析", () => {
    const result = resolveSession({
      cfg: createCfgWithSessionKey("agent:mybot:custom:extra"),
      apiKey: "test-key",
      accountId: "default",
      openid: "user123",
    });

    expect(result.sessionKey).toBe("agent:mybot:custom:extra");
    expect(result.agentId).toBe("mybot");
  });

  it("agent 前缀大小写不敏感", () => {
    const result = resolveSession({
      cfg: createCfgWithSessionKey("Agent:MyBot:main"),
      apiKey: "test-key",
      accountId: "default",
      openid: "user123",
    });

    expect(result.sessionKey).toBe("Agent:MyBot:main");
    expect(result.agentId).toBe("MyBot");
  });
});
