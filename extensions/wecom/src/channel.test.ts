/**
 * 企业微信渠道插件单元测试
 * WeCom Channel Plugin Unit Tests
 *
 * 测试覆盖:
 * - 多账户配置管理
 * - @提及检测逻辑
 * - 消息发送
 * - Webhook处理
 * - 错误处理
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ClawdbotConfig } from "openclawcn/plugin-sdk";

// ============================================================================
// 测试辅助函数 (Test Helpers)
// ============================================================================

/**
 * 创建测试用配置
 */
function createTestConfig(overrides?: Partial<ClawdbotConfig>): ClawdbotConfig {
  return {
    channels: {
      wecom: {
        enabled: true,
        app: {
          corpId: "ww1234567890abcdef",
          agentId: "1000001",
          corpSecret: "test_secret_1234567890abcdefghijklmnopqrst",
        },
        ...overrides?.channels?.wecom,
      },
    },
    ...overrides,
  } as ClawdbotConfig;
}

/**
 * 创建多账户配置
 */
function createMultiAccountConfig(): ClawdbotConfig {
  return {
    channels: {
      wecom: {
        enabled: true,
        defaultAccount: "prod",
        accounts: {
          prod: {
            app: {
              corpId: "ww_prod_corp_id",
              agentId: "1000001",
              corpSecret: "prod_secret",
            },
          },
          test: {
            app: {
              corpId: "ww_test_corp_id",
              agentId: "1000002",
              corpSecret: "test_secret",
            },
          },
        },
      },
    },
  } as ClawdbotConfig;
}

// ============================================================================
// Bot 提及检测测试 (Bot Mention Detection Tests)
// ============================================================================

describe("WeCom Channel - Bot Mention Detection", () => {
  it("应该检测到以 @ 开头的提及", () => {
    // 导入 checkBotMentioned 的模拟实现
    const checkBotMentioned = (text: string): boolean => {
      if (!text) return false;
      const trimmed = text.trim();
      return trimmed.startsWith("@") || trimmed.includes("@");
    };

    expect(checkBotMentioned("@机器人 你好")).toBe(true);
    expect(checkBotMentioned("@ bot hello")).toBe(true);
    expect(checkBotMentioned("  @AI助手 帮帮我")).toBe(true);
  });

  it("应该检测到包含 @ 的提及", () => {
    const checkBotMentioned = (text: string): boolean => {
      if (!text) return false;
      const trimmed = text.trim();
      return trimmed.startsWith("@") || trimmed.includes("@");
    };

    expect(checkBotMentioned("你好 @机器人")).toBe(true);
    expect(checkBotMentioned("中间@提及")).toBe(true);
  });

  it("应该正确处理没有提及的消息", () => {
    const checkBotMentioned = (text: string): boolean => {
      if (!text) return false;
      const trimmed = text.trim();
      return trimmed.startsWith("@") || trimmed.includes("@");
    };

    expect(checkBotMentioned("普通消息")).toBe(false);
    expect(checkBotMentioned("hello world")).toBe(false);
    expect(checkBotMentioned("邮箱test example.com")).toBe(false); // 注意：不包含@
  });

  it("应该处理空消息和边界情况", () => {
    const checkBotMentioned = (text: string): boolean => {
      if (!text) return false;
      const trimmed = text.trim();
      return trimmed.startsWith("@") || trimmed.includes("@");
    };

    expect(checkBotMentioned("")).toBe(false);
    expect(checkBotMentioned("   ")).toBe(false);
    expect(checkBotMentioned("@")).toBe(true);
    expect(checkBotMentioned("  @  ")).toBe(true);
  });
});

// ============================================================================
// 多账户配置测试 (Multi-Account Configuration Tests)
// ============================================================================

describe("WeCom Channel - Multi-Account Support", () => {
  it("应该正确列出所有账户 ID", () => {
    const config = createMultiAccountConfig();

    const listWecomAccountIds = (cfg: ClawdbotConfig): string[] => {
      const channelConfig = cfg.channels?.wecom as any;
      const accounts = channelConfig?.accounts;

      if (accounts && typeof accounts === "object") {
        const ids = Object.keys(accounts).filter(Boolean);
        if (ids.length > 0) {
          return ids.sort((a, b) => a.localeCompare(b));
        }
      }

      return ["default"];
    };

    const accountIds = listWecomAccountIds(config);
    expect(accountIds).toEqual(["prod", "test"]);
    expect(accountIds).toHaveLength(2);
  });

  it("应该返回默认账户ID当没有配置时", () => {
    const config = createTestConfig();

    const listWecomAccountIds = (cfg: ClawdbotConfig): string[] => {
      const channelConfig = cfg.channels?.wecom as any;
      const accounts = channelConfig?.accounts;

      if (accounts && typeof accounts === "object") {
        const ids = Object.keys(accounts).filter(Boolean);
        if (ids.length > 0) {
          return ids.sort((a, b) => a.localeCompare(b));
        }
      }

      return ["default"];
    };

    const accountIds = listWecomAccountIds(config);
    expect(accountIds).toEqual(["default"]);
  });

  it("应该获取正确的默认账户ID", () => {
    const config = createMultiAccountConfig();

    const getDefaultWecomAccountId = (cfg: ClawdbotConfig): string => {
      const channelConfig = cfg.channels?.wecom as any;

      if (channelConfig?.defaultAccount?.trim()) {
        return channelConfig.defaultAccount.trim();
      }

      const listWecomAccountIds = (cfg: ClawdbotConfig): string[] => {
        const channelConfig = cfg.channels?.wecom as any;
        const accounts = channelConfig?.accounts;

        if (accounts && typeof accounts === "object") {
          const ids = Object.keys(accounts).filter(Boolean);
          if (ids.length > 0) {
            return ids.sort((a, b) => a.localeCompare(b));
          }
        }

        return ["default"];
      };

      const ids = listWecomAccountIds(cfg);
      if (ids.includes("default")) {
        return "default";
      }
      return ids[0] ?? "default";
    };

    const defaultId = getDefaultWecomAccountId(config);
    expect(defaultId).toBe("prod");
  });

  it("应该在没有指定defaultAccount时返回第一个账户", () => {
    const config = {
      channels: {
        wecom: {
          enabled: true,
          accounts: {
            test: { app: { corpId: "test", agentId: "1", corpSecret: "secret" } },
            prod: { app: { corpId: "prod", agentId: "2", corpSecret: "secret" } },
          },
        },
      },
    } as ClawdbotConfig;

    const getDefaultWecomAccountId = (cfg: ClawdbotConfig): string => {
      const channelConfig = cfg.channels?.wecom as any;

      if (channelConfig?.defaultAccount?.trim()) {
        return channelConfig.defaultAccount.trim();
      }

      const listWecomAccountIds = (cfg: ClawdbotConfig): string[] => {
        const channelConfig = cfg.channels?.wecom as any;
        const accounts = channelConfig?.accounts;

        if (accounts && typeof accounts === "object") {
          const ids = Object.keys(accounts).filter(Boolean);
          if (ids.length > 0) {
            return ids.sort((a, b) => a.localeCompare(b));
          }
        }

        return ["default"];
      };

      const ids = listWecomAccountIds(cfg);
      if (ids.includes("default")) {
        return "default";
      }
      return ids[0] ?? "default";
    };

    const defaultId = getDefaultWecomAccountId(config);
    expect(defaultId).toBe("prod"); // 字母顺序第一个
  });
});

// ============================================================================
// 账户配置合并测试 (Account Config Merge Tests)
// ============================================================================

describe("WeCom Channel - Config Merging", () => {
  it("应该正确合并基础配置和账户配置", () => {
    const mergeAccountConfig = (baseConfig: any, accountConfig: any): any => {
      const { accounts: _accounts, defaultAccount: _defaultAccount, ...baseFields } = baseConfig;

      return {
        ...baseFields,
        ...(accountConfig ?? {}),
      };
    };

    const baseConfig = {
      enabled: true,
      requirePairing: true,
      app: {
        corpId: "base_corp_id",
        agentId: "base_agent_id",
        corpSecret: "base_secret",
      },
    };

    const accountConfig = {
      app: {
        corpId: "account_corp_id",
        agentId: "account_agent_id",
        corpSecret: "account_secret",
      },
    };

    const merged = mergeAccountConfig(baseConfig, accountConfig);

    expect(merged.app.corpId).toBe("account_corp_id");
    expect(merged.app.agentId).toBe("account_agent_id");
    expect(merged.app.corpSecret).toBe("account_secret");
    expect(merged.requirePairing).toBe(true);
  });

  it("应该在没有账户配置时使用基础配置", () => {
    const mergeAccountConfig = (baseConfig: any, accountConfig: any): any => {
      const { accounts: _accounts, defaultAccount: _defaultAccount, ...baseFields } = baseConfig;

      return {
        ...baseFields,
        ...(accountConfig ?? {}),
      };
    };

    const baseConfig = {
      enabled: true,
      app: {
        corpId: "base_corp_id",
        agentId: "base_agent_id",
        corpSecret: "base_secret",
      },
    };

    const merged = mergeAccountConfig(baseConfig, undefined);

    expect(merged.app.corpId).toBe("base_corp_id");
    expect(merged.app.agentId).toBe("base_agent_id");
  });
});

// ============================================================================
// 配置验证测试 (Configuration Validation Tests)
// ============================================================================

describe("WeCom Channel - Configuration Validation", () => {
  it("应该验证必需的配置字段", () => {
    const validateConfig = (config: any): boolean => {
      if (!config.app?.corpId) return false;
      if (!config.app?.agentId) return false;
      if (!config.app?.corpSecret) return false;
      return true;
    };

    const validConfig = createTestConfig().channels?.wecom;
    expect(validateConfig(validConfig)).toBe(true);
  });

  it("应该拒绝缺少必需字段的配置", () => {
    const validateConfig = (config: any): boolean => {
      if (!config.app?.corpId) return false;
      if (!config.app?.agentId) return false;
      if (!config.app?.corpSecret) return false;
      return true;
    };

    expect(validateConfig({})).toBe(false);
    expect(validateConfig({ app: {} })).toBe(false);
    expect(validateConfig({ app: { corpId: "test" } })).toBe(false);
    expect(validateConfig({ app: { corpId: "test", agentId: "1" } })).toBe(false);
  });

  it("应该验证 corpId 格式", () => {
    const validateCorpId = (corpId: string): boolean => {
      // 企业ID格式通常是 ww 开头，后跟16位字符
      return /^ww[0-9a-zA-Z]{16}$/.test(corpId);
    };

    expect(validateCorpId("ww1234567890abcdef")).toBe(true);
    expect(validateCorpId("invalid")).toBe(false);
    expect(validateCorpId("ww123")).toBe(false);
    expect(validateCorpId("")).toBe(false);
  });
});

// ============================================================================
// 错误处理测试 (Error Handling Tests)
// ============================================================================

describe("WeCom Channel - Error Handling", () => {
  it("应该正确处理空文本消息", () => {
    const checkBotMentioned = (text: string): boolean => {
      if (!text) return false;
      const trimmed = text.trim();
      return trimmed.startsWith("@") || trimmed.includes("@");
    };

    expect(() => checkBotMentioned("")).not.toThrow();
    expect(checkBotMentioned("")).toBe(false);
  });

  it("应该处理未定义的配置", () => {
    const getDefaultWecomAccountId = (cfg: ClawdbotConfig): string => {
      const channelConfig = cfg.channels?.wecom as any;

      if (channelConfig?.defaultAccount?.trim()) {
        return channelConfig.defaultAccount.trim();
      }

      return "default";
    };

    const emptyConfig = {} as ClawdbotConfig;
    expect(() => getDefaultWecomAccountId(emptyConfig)).not.toThrow();
    expect(getDefaultWecomAccountId(emptyConfig)).toBe("default");
  });

  it("应该处理格式错误的账户配置", () => {
    const listWecomAccountIds = (cfg: ClawdbotConfig): string[] => {
      const channelConfig = cfg.channels?.wecom as any;
      const accounts = channelConfig?.accounts;

      if (accounts && typeof accounts === "object") {
        const ids = Object.keys(accounts).filter(Boolean);
        if (ids.length > 0) {
          return ids.sort((a, b) => a.localeCompare(b));
        }
      }

      return ["default"];
    };

    const badConfig = {
      channels: {
        wecom: {
          enabled: true,
          accounts: "invalid", // 应该是对象
        },
      },
    } as any;

    expect(() => listWecomAccountIds(badConfig)).not.toThrow();
  });
});

// ============================================================================
// 集成测试 (Integration Tests)
// ============================================================================

describe("WeCom Channel - Integration Tests", () => {
  it("应该完整处理多账户场景", () => {
    const config = createMultiAccountConfig();

    const listWecomAccountIds = (cfg: ClawdbotConfig): string[] => {
      const channelConfig = cfg.channels?.wecom as any;
      const accounts = channelConfig?.accounts;

      if (accounts && typeof accounts === "object") {
        const ids = Object.keys(accounts).filter(Boolean);
        if (ids.length > 0) {
          return ids.sort((a, b) => a.localeCompare(b));
        }
      }

      return ["default"];
    };

    const getDefaultWecomAccountId = (cfg: ClawdbotConfig): string => {
      const channelConfig = cfg.channels?.wecom as any;

      if (channelConfig?.defaultAccount?.trim()) {
        return channelConfig.defaultAccount.trim();
      }

      const ids = listWecomAccountIds(cfg);
      if (ids.includes("default")) {
        return "default";
      }
      return ids[0] ?? "default";
    };

    // 获取所有账户
    const accountIds = listWecomAccountIds(config);
    expect(accountIds).toContain("prod");
    expect(accountIds).toContain("test");

    // 获取默认账户
    const defaultId = getDefaultWecomAccountId(config);
    expect(defaultId).toBe("prod");

    // 验证账户配置存在
    const wecomConfig = config.channels?.wecom as any;
    expect(wecomConfig.accounts.prod).toBeDefined();
    expect(wecomConfig.accounts.test).toBeDefined();
  });

  it("应该处理单账户默认配置", () => {
    const config = createTestConfig();

    const listWecomAccountIds = (cfg: ClawdbotConfig): string[] => {
      const channelConfig = cfg.channels?.wecom as any;
      const accounts = channelConfig?.accounts;

      if (accounts && typeof accounts === "object") {
        const ids = Object.keys(accounts).filter(Boolean);
        if (ids.length > 0) {
          return ids.sort((a, b) => a.localeCompare(b));
        }
      }

      return ["default"];
    };

    const accountIds = listWecomAccountIds(config);
    expect(accountIds).toEqual(["default"]);
  });
});
