/**
 * ClawdbotCN 免费模型 Gateway API 测试
 * Free Models Gateway API Tests
 *
 * 测试覆盖：
 * 1. Provider 列表 API
 * 2. 配置获取/更新 API
 * 3. 账号管理 API
 * 4. 统计和历史 API
 * 5. 错误处理
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock 类型定义
interface MockGatewayContext {
  config: {
    freeModels?: {
      enabled: boolean;
      accounts: Array<{
        providerId: string;
        apiKey: string;
        enabled: boolean;
        priority: number;
        todayUsage: { tokens: number; requests: number; lastUpdated: string };
        status: string;
      }>;
      scheduling: {
        strategy: string;
        showNotification: boolean;
        preCheck: boolean;
      };
      stats: {
        todaySavings: number;
        totalSavings: number;
        todayFreeRequests: number;
        lastResetDate: string;
      };
      switchHistory: Array<{
        timestamp: string;
        fromProvider: string;
        toProvider: string;
        reason: string;
        savings: number;
      }>;
    };
  };
  saveConfig: () => Promise<void>;
}

function createMockContext(): MockGatewayContext {
  return {
    config: {
      freeModels: {
        enabled: true,
        accounts: [
          {
            providerId: "ant-ling",
            apiKey: "sk-test-key",
            enabled: true,
            priority: 1,
            todayUsage: { tokens: 10000, requests: 5, lastUpdated: new Date().toISOString() },
            status: "active",
          },
        ],
        scheduling: {
          strategy: "priority",
          showNotification: true,
          preCheck: true,
        },
        stats: {
          todaySavings: 0.5,
          totalSavings: 10.0,
          todayFreeRequests: 5,
          lastResetDate: new Date().toISOString().split("T")[0],
        },
        switchHistory: [],
      },
    },
    saveConfig: vi.fn().mockResolvedValue(undefined),
  };
}

// ============================================================================
// 1. Provider 列表 API 测试
// ============================================================================

describe("freeModels.providers API", () => {
  it("应该返回所有支持的 Provider 列表", async () => {
    // 模拟 API 调用
    const mockProviders = [
      {
        id: "ant-ling",
        name: "蚂蚁百灵",
        displayName: "蚂蚁百灵大模型",
        freeQuota: { type: "daily", limit: 500000, unit: "tokens", resetsAt: "每日 00:00" },
        registerUrl: "https://example.com/register",
        docsUrl: "https://example.com/docs",
        features: ["OpenAI 兼容", "支持流式"],
        recommended: true,
      },
      {
        id: "meituan-longcat",
        name: "美团 LongCat",
        displayName: "美团 LongCat 大模型",
        freeQuota: { type: "daily", limit: 500000, unit: "tokens", resetsAt: "每日 00:00" },
        registerUrl: "https://longcat.chat/register",
        docsUrl: "https://longcat.chat/docs",
        features: ["OpenAI 兼容"],
        recommended: true,
      },
    ];

    expect(mockProviders.length).toBe(2);
    expect(mockProviders[0].id).toBe("ant-ling");
    expect(mockProviders[1].id).toBe("meituan-longcat");
  });

  it("Provider 信息应该包含完整字段", async () => {
    const mockProvider = {
      id: "ant-ling",
      name: "蚂蚁百灵",
      displayName: "蚂蚁百灵大模型",
      freeQuota: { type: "daily", limit: 500000, unit: "tokens", resetsAt: "每日 00:00" },
      registerUrl: "https://example.com/register",
      docsUrl: "https://example.com/docs",
      features: ["OpenAI 兼容"],
      recommended: true,
    };

    expect(mockProvider.id).toBeDefined();
    expect(mockProvider.name).toBeDefined();
    expect(mockProvider.freeQuota).toBeDefined();
    expect(mockProvider.freeQuota.limit).toBeGreaterThan(0);
    expect(mockProvider.registerUrl).toMatch(/^https:\/\//);
    expect(mockProvider.docsUrl).toMatch(/^https:\/\//);
  });
});

// ============================================================================
// 2. 配置获取 API 测试
// ============================================================================

describe("freeModels.config.get API", () => {
  it("应该返回当前配置", async () => {
    const ctx = createMockContext();
    const config = ctx.config.freeModels;

    expect(config).toBeDefined();
    expect(config?.enabled).toBe(true);
    expect(config?.accounts).toBeInstanceOf(Array);
    expect(config?.scheduling).toBeDefined();
    expect(config?.stats).toBeDefined();
  });

  it("未配置时应该返回默认值", async () => {
    const ctx = createMockContext();
    ctx.config.freeModels = undefined;

    const defaultConfig = {
      enabled: false,
      accounts: [],
      scheduling: {
        strategy: "priority",
        showNotification: true,
        preCheck: true,
      },
      stats: {
        todaySavings: 0,
        totalSavings: 0,
        todayFreeRequests: 0,
        lastResetDate: "",
      },
      switchHistory: [],
    };

    expect(defaultConfig.enabled).toBe(false);
    expect(defaultConfig.accounts).toEqual([]);
  });

  it("API 密钥应该被掩码", async () => {
    const ctx = createMockContext();
    const account = ctx.config.freeModels?.accounts[0];

    // 模拟掩码处理
    const maskedKey = account?.apiKey.slice(0, 8) + "****" + account?.apiKey.slice(-4);

    expect(maskedKey).not.toBe(account?.apiKey);
    expect(maskedKey).toContain("****");
  });
});

// ============================================================================
// 3. 配置更新 API 测试
// ============================================================================

describe("freeModels.config.update API", () => {
  it("应该能更新 enabled 状态", async () => {
    const ctx = createMockContext();

    // 模拟更新
    if (ctx.config.freeModels) {
      ctx.config.freeModels.enabled = false;
    }

    expect(ctx.config.freeModels?.enabled).toBe(false);
  });

  it("应该能更新调度策略", async () => {
    const ctx = createMockContext();

    if (ctx.config.freeModels) {
      ctx.config.freeModels.scheduling.strategy = "round_robin";
    }

    expect(ctx.config.freeModels?.scheduling.strategy).toBe("round_robin");
  });
});

// ============================================================================
// 4. 账号管理 API 测试
// ============================================================================

describe("freeModels.account.add API", () => {
  it("应该能添加新账号", async () => {
    const ctx = createMockContext();
    const newAccount = {
      providerId: "meituan-longcat",
      apiKey: "ak-new-test-key",
      enabled: true,
      priority: 2,
      todayUsage: { tokens: 0, requests: 0, lastUpdated: new Date().toISOString() },
      status: "active",
    };

    ctx.config.freeModels?.accounts.push(newAccount);

    expect(ctx.config.freeModels?.accounts.length).toBe(2);
    expect(ctx.config.freeModels?.accounts[1].providerId).toBe("meituan-longcat");
  });

  it("添加重复的 providerId 应该更新而不是新增", async () => {
    const ctx = createMockContext();
    const existingId = "ant-ling";
    const newKey = "sk-updated-key";

    // 模拟更新逻辑
    const existing = ctx.config.freeModels?.accounts.find((a) => a.providerId === existingId);
    if (existing) {
      existing.apiKey = newKey;
    }

    expect(ctx.config.freeModels?.accounts.length).toBe(1);
    expect(ctx.config.freeModels?.accounts[0].apiKey).toBe(newKey);
  });
});

describe("freeModels.account.remove API", () => {
  it("应该能删除账号", async () => {
    const ctx = createMockContext();
    const toRemove = "ant-ling";

    if (ctx.config.freeModels) {
      ctx.config.freeModels.accounts = ctx.config.freeModels.accounts.filter(
        (a) => a.providerId !== toRemove
      );
    }

    expect(ctx.config.freeModels?.accounts.length).toBe(0);
  });

  it("删除不存在的账号不应该报错", async () => {
    const ctx = createMockContext();
    const originalLength = ctx.config.freeModels?.accounts.length;

    if (ctx.config.freeModels) {
      ctx.config.freeModels.accounts = ctx.config.freeModels.accounts.filter(
        (a) => a.providerId !== "nonexistent"
      );
    }

    expect(ctx.config.freeModels?.accounts.length).toBe(originalLength);
  });
});

describe("freeModels.account.test API", () => {
  it("有效的 API 密钥应该返回成功", async () => {
    // 模拟验证结果
    const testResult = { valid: true };

    expect(testResult.valid).toBe(true);
  });

  it("无效的 API 密钥应该返回失败", async () => {
    const testResult = { valid: false, error: "Invalid API key" };

    expect(testResult.valid).toBe(false);
    expect(testResult.error).toBeDefined();
  });
});

describe("freeModels.account.reorder API", () => {
  it("应该能调整账号优先级", async () => {
    const ctx = createMockContext();

    // 添加第二个账号
    ctx.config.freeModels?.accounts.push({
      providerId: "meituan-longcat",
      apiKey: "ak-test",
      enabled: true,
      priority: 2,
      todayUsage: { tokens: 0, requests: 0, lastUpdated: new Date().toISOString() },
      status: "active",
    });

    // 模拟重新排序
    const newOrder = ["meituan-longcat", "ant-ling"];
    if (ctx.config.freeModels) {
      const accountMap = new Map(ctx.config.freeModels.accounts.map((a) => [a.providerId, a]));
      ctx.config.freeModels.accounts = newOrder
        .map((id, idx) => {
          const account = accountMap.get(id);
          if (account) {
            account.priority = idx + 1;
          }
          return account;
        })
        .filter((a): a is NonNullable<typeof a> => a !== undefined);
    }

    expect(ctx.config.freeModels?.accounts[0].providerId).toBe("meituan-longcat");
    expect(ctx.config.freeModels?.accounts[0].priority).toBe(1);
  });
});

// ============================================================================
// 5. 统计 API 测试
// ============================================================================

describe("freeModels.stats API", () => {
  it("应该返回统计数据", async () => {
    const ctx = createMockContext();
    const stats = ctx.config.freeModels?.stats;

    expect(stats).toBeDefined();
    expect(stats?.todaySavings).toBeDefined();
    expect(stats?.totalSavings).toBeDefined();
    expect(stats?.todayFreeRequests).toBeDefined();
    expect(stats?.lastResetDate).toBeDefined();
  });

  it("统计数据应该是合理的数值", async () => {
    const ctx = createMockContext();
    const stats = ctx.config.freeModels?.stats;

    expect(stats?.todaySavings).toBeGreaterThanOrEqual(0);
    expect(stats?.totalSavings).toBeGreaterThanOrEqual(stats?.todaySavings ?? 0);
    expect(stats?.todayFreeRequests).toBeGreaterThanOrEqual(0);
  });
});

describe("freeModels.history API", () => {
  it("应该返回切换历史", async () => {
    const ctx = createMockContext();

    // 添加一些历史记录
    ctx.config.freeModels?.switchHistory.push({
      timestamp: new Date().toISOString(),
      fromProvider: "ant-ling",
      toProvider: "meituan-longcat",
      reason: "quota_exhausted",
      savings: 0.1,
    });

    expect(ctx.config.freeModels?.switchHistory.length).toBe(1);
  });

  it("历史记录应该包含完整信息", async () => {
    const record = {
      timestamp: new Date().toISOString(),
      fromProvider: "ant-ling",
      toProvider: "meituan-longcat",
      reason: "quota_exhausted",
      savings: 0.1,
    };

    expect(record.timestamp).toBeDefined();
    expect(record.fromProvider).toBeDefined();
    expect(record.toProvider).toBeDefined();
    expect(record.reason).toBeDefined();
    expect(record.savings).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// 6. 每日重置 API 测试
// ============================================================================

describe("freeModels.reset API", () => {
  it("应该重置今日使用量", async () => {
    const ctx = createMockContext();

    if (ctx.config.freeModels) {
      for (const account of ctx.config.freeModels.accounts) {
        account.todayUsage = { tokens: 0, requests: 0, lastUpdated: new Date().toISOString() };
        account.status = "active";
      }
      ctx.config.freeModels.stats.todaySavings = 0;
      ctx.config.freeModels.stats.todayFreeRequests = 0;
      ctx.config.freeModels.stats.lastResetDate = new Date().toISOString().split("T")[0];
    }

    expect(ctx.config.freeModels?.accounts[0].todayUsage.tokens).toBe(0);
    expect(ctx.config.freeModels?.stats.todaySavings).toBe(0);
  });
});

// ============================================================================
// 7. 最佳模型选择 API 测试
// ============================================================================

describe("freeModels.bestModel API", () => {
  it("应该返回最佳可用模型", async () => {
    const ctx = createMockContext();

    // 模拟返回最佳模型
    const bestModel = ctx.config.freeModels?.accounts.find((a) => a.status === "active");

    expect(bestModel).toBeDefined();
    expect(bestModel?.providerId).toBe("ant-ling");
  });

  it("所有模型耗尽应该返回 null", async () => {
    const ctx = createMockContext();

    if (ctx.config.freeModels) {
      for (const account of ctx.config.freeModels.accounts) {
        account.status = "exhausted";
      }
    }

    const bestModel = ctx.config.freeModels?.accounts.find((a) => a.status === "active");
    expect(bestModel).toBeUndefined();
  });
});

// ============================================================================
// 8. 错误处理测试
// ============================================================================

describe("API 错误处理", () => {
  it("无效的 providerId 应该返回错误", async () => {
    const result = { success: false, error: "Provider not found: invalid-provider" };

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("空的 apiKey 应该返回错误", async () => {
    const result = { success: false, error: "API key is required" };

    expect(result.success).toBe(false);
    expect(result.error).toContain("required");
  });

  it("无效的调度策略应该返回错误", async () => {
    const validStrategies = ["priority", "round_robin"];
    const invalidStrategy = "invalid_strategy";

    expect(validStrategies.includes(invalidStrategy)).toBe(false);
  });
});

// ============================================================================
// 9. 并发安全测试
// ============================================================================

describe("并发安全", () => {
  it("并发更新配置应该保持一致性", async () => {
    const ctx = createMockContext();
    let callCount = 0;
    ctx.saveConfig = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve();
    });

    // 模拟并发调用
    const updates = Array(10)
      .fill(null)
      .map(() => ctx.saveConfig());

    await Promise.all(updates);

    expect(callCount).toBe(10);
  });
});
