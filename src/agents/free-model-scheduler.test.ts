/**
 * ClawdbotCN 免费模型调度器测试
 * Free Model Scheduler Tests
 *
 * 测试覆盖：
 * 1. 调度器初始化
 * 2. 最佳账号选择
 * 3. 额度耗尽检测
 * 4. 账号切换逻辑
 * 5. 统计更新
 * 6. 每日重置
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { FreeModelScheduler, createFreeModelScheduler } from "./free-model-scheduler.js";
import type { FreeModelsConfig, FreeModelAccount } from "../config/types.free-models.js";

// ============================================================================
// Mock 配置
// ============================================================================

function createMockConfig(overrides?: Partial<FreeModelsConfig>): FreeModelsConfig {
  return {
    enabled: true,
    accounts: [
      {
        providerId: "ant-ling",
        apiKey: "sk-test-ant-ling-key",
        enabled: true,
        priority: 1,
        todayUsage: { tokens: 0, requests: 0, lastUpdated: new Date().toISOString() },
        status: "active",
      },
      {
        providerId: "meituan-longcat",
        apiKey: "ak-test-longcat-key",
        enabled: true,
        priority: 2,
        todayUsage: { tokens: 0, requests: 0, lastUpdated: new Date().toISOString() },
        status: "active",
      },
    ],
    scheduling: {
      strategy: "priority",
      showNotification: true,
      preCheck: true,
    },
    stats: {
      todaySavings: 0,
      totalSavings: 0,
      todayFreeRequests: 0,
      lastResetDate: new Date().toISOString().split("T")[0],
    },
    switchHistory: [],
    ...overrides,
  };
}

function createExhaustedAccount(providerId: string): FreeModelAccount {
  return {
    providerId,
    apiKey: `sk-test-${providerId}`,
    enabled: true,
    priority: 1,
    todayUsage: { tokens: 500000, requests: 100, lastUpdated: new Date().toISOString() },
    status: "exhausted",
  };
}

// ============================================================================
// 1. 调度器初始化测试
// ============================================================================

describe("调度器初始化", () => {
  it("应该正确初始化调度器", () => {
    const config = createMockConfig();
    const scheduler = new FreeModelScheduler(config);

    expect(scheduler).toBeDefined();
    expect(scheduler.getConfig().enabled).toBe(true);
  });

  it("禁用配置应该返回 enabled = false", () => {
    const config = createMockConfig({ enabled: false });
    const scheduler = new FreeModelScheduler(config);

    expect(scheduler.getConfig().enabled).toBe(false);
  });

  it("空账号列表应该正确处理", () => {
    const config = createMockConfig({ accounts: [] });
    const scheduler = new FreeModelScheduler(config);

    expect(scheduler.getConfig().enabled).toBe(true);
    expect(scheduler.selectBestAccount()).toBeUndefined();
  });

  it("createFreeModelScheduler 应该创建调度器实例", () => {
    const config = createMockConfig();
    const scheduler = createFreeModelScheduler(config);

    expect(scheduler).toBeInstanceOf(FreeModelScheduler);
  });
});

// ============================================================================
// 2. 最佳账号选择测试
// ============================================================================

describe("最佳账号选择", () => {
  describe("优先级策略", () => {
    it("应该选择优先级最高的可用账号", () => {
      const config = createMockConfig();
      const scheduler = new FreeModelScheduler(config);

      const best = scheduler.selectBestAccount();
      expect(best?.providerId).toBe("ant-ling");
    });

    it("优先级高的账号耗尽后应该选择下一个", () => {
      const config = createMockConfig({
        accounts: [
          createExhaustedAccount("ant-ling"),
          {
            providerId: "meituan-longcat",
            apiKey: "ak-test",
            enabled: true,
            priority: 2,
            todayUsage: { tokens: 0, requests: 0, lastUpdated: new Date().toISOString() },
            status: "active",
          },
        ],
      });
      const scheduler = new FreeModelScheduler(config);

      const best = scheduler.selectBestAccount();
      expect(best?.providerId).toBe("meituan-longcat");
    });

    it("所有账号耗尽应该返回 undefined", () => {
      const config = createMockConfig({
        accounts: [
          createExhaustedAccount("ant-ling"),
          { ...createExhaustedAccount("meituan-longcat"), priority: 2 },
        ],
      });
      const scheduler = new FreeModelScheduler(config);

      const best = scheduler.selectBestAccount();
      expect(best).toBeUndefined();
    });
  });

  describe("轮询策略", () => {
    it("应该选择请求次数最少的账号", () => {
      const config = createMockConfig({
        scheduling: { strategy: "round_robin", showNotification: true, preCheck: true },
        accounts: [
          {
            providerId: "ant-ling",
            apiKey: "sk-test",
            enabled: true,
            priority: 1,
            todayUsage: { tokens: 1000, requests: 10, lastUpdated: new Date().toISOString() },
            status: "active",
          },
          {
            providerId: "meituan-longcat",
            apiKey: "ak-test",
            enabled: true,
            priority: 2,
            todayUsage: { tokens: 500, requests: 5, lastUpdated: new Date().toISOString() },
            status: "active",
          },
        ],
      });
      const scheduler = new FreeModelScheduler(config);

      const best = scheduler.selectBestAccount();
      expect(best?.providerId).toBe("meituan-longcat");
    });
  });

  describe("禁用账号处理", () => {
    it("禁用的账号不应该被选择", () => {
      const config = createMockConfig({
        accounts: [
          {
            providerId: "ant-ling",
            apiKey: "sk-test",
            enabled: false,
            priority: 1,
            todayUsage: { tokens: 0, requests: 0, lastUpdated: new Date().toISOString() },
            status: "active",
          },
          {
            providerId: "meituan-longcat",
            apiKey: "ak-test",
            enabled: true,
            priority: 2,
            todayUsage: { tokens: 0, requests: 0, lastUpdated: new Date().toISOString() },
            status: "active",
          },
        ],
      });
      const scheduler = new FreeModelScheduler(config);

      const best = scheduler.selectBestAccount();
      expect(best?.providerId).toBe("meituan-longcat");
    });
  });
});

// ============================================================================
// 3. 额度耗尽检测测试
// ============================================================================

describe("额度耗尽检测", () => {
  it("应该识别 HTTP 402 错误", () => {
    const scheduler = new FreeModelScheduler(createMockConfig());
    const result = scheduler.detectQuotaError("ant-ling", 402, { message: "Payment required" });

    // 402 + "payment required" 消息会匹配 billing 关键词
    expect(result.isQuotaError).toBe(true);
    expect(result.confidence).toBe("high");
  });

  it("应该识别 HTTP 429 错误", () => {
    const scheduler = new FreeModelScheduler(createMockConfig());
    const result = scheduler.detectQuotaError("ant-ling", 429, { message: "Rate limited" });

    expect(result.confidence).toBe("medium");
  });

  it("应该识别中文额度错误消息", () => {
    const scheduler = new FreeModelScheduler(createMockConfig());
    const result = scheduler.detectQuotaError("ant-ling", 200, {
      message: "额度不足，请充值后再试",
    });

    expect(result.isQuotaError).toBe(true);
    expect(result.reason).toBe("daily_limit");
  });

  it("应该识别英文额度错误消息", () => {
    const scheduler = new FreeModelScheduler(createMockConfig());
    const result = scheduler.detectQuotaError("meituan-longcat", 200, {
      message: "quota exceeded",
    });

    expect(result.isQuotaError).toBe(true);
  });

  it("应该识别 Provider 特定数字错误码", () => {
    const scheduler = new FreeModelScheduler(createMockConfig());
    const result = scheduler.detectQuotaError("ant-ling", 200, { code: 41 });

    expect(result.isQuotaError).toBe(true);
    expect(result.confidence).toBe("high");
  });

  it("应该识别 Provider 特定字符串错误码", () => {
    const scheduler = new FreeModelScheduler(createMockConfig());
    const result = scheduler.detectQuotaError("meituan-longcat", 200, {
      error: { code: "quota_exceeded" },
    });

    expect(result.isQuotaError).toBe(true);
    expect(result.confidence).toBe("high");
  });

  it("不应该误判普通错误", () => {
    const scheduler = new FreeModelScheduler(createMockConfig());
    const result = scheduler.detectQuotaError("ant-ling", 500, {
      message: "Internal server error",
    });

    expect(result.isQuotaError).toBe(false);
  });
});

// ============================================================================
// 4. 账号切换逻辑测试
// ============================================================================

describe("账号切换逻辑", () => {
  it("handleQuotaExhausted 应该返回下一个可用账号", async () => {
    const config = createMockConfig();
    const scheduler = new FreeModelScheduler(config);

    const result = await scheduler.handleQuotaExhausted("ant-ling");

    expect(result.nextAccount?.providerId).toBe("meituan-longcat");
    expect(result.notification.type).toBe("switch");
  });

  it("所有账号耗尽时应该返回 all_exhausted 通知", async () => {
    const config = createMockConfig({
      accounts: [createExhaustedAccount("ant-ling")],
    });
    // 把第一个账号标记为 active，这样可以触发切换
    config.accounts[0].status = "active";
    const scheduler = new FreeModelScheduler(config);

    const result = await scheduler.handleQuotaExhausted("ant-ling");

    expect(result.nextAccount).toBeUndefined();
    expect(result.notification.type).toBe("all_exhausted");
  });

  it("切换应该更新统计数据", async () => {
    const onConfigChange = vi.fn();
    const config = createMockConfig();
    const scheduler = new FreeModelScheduler(config, onConfigChange);

    await scheduler.handleQuotaExhausted("ant-ling");

    expect(onConfigChange).toHaveBeenCalled();
  });
});

// ============================================================================
// 5. 统计更新测试
// ============================================================================

describe("统计更新", () => {
  it("updateUsage 应该更新账号使用量", async () => {
    const config = createMockConfig();
    const scheduler = new FreeModelScheduler(config);

    await scheduler.updateUsage("ant-ling", 1000);

    const updated = scheduler.getConfig().accounts.find((a) => a.providerId === "ant-ling");
    expect(updated?.todayUsage.tokens).toBe(1000);
    expect(updated?.todayUsage.requests).toBe(1);
  });

  it("多次记录应该累加", async () => {
    const config = createMockConfig();
    const scheduler = new FreeModelScheduler(config);

    await scheduler.updateUsage("ant-ling", 1000);
    await scheduler.updateUsage("ant-ling", 2000);

    const updated = scheduler.getConfig().accounts.find((a) => a.providerId === "ant-ling");
    expect(updated?.todayUsage.tokens).toBe(3000);
    expect(updated?.todayUsage.requests).toBe(2);
  });

  it("updateUsage 应该更新今日免费请求数", async () => {
    const config = createMockConfig();
    const scheduler = new FreeModelScheduler(config);

    await scheduler.updateUsage("ant-ling", 1000);

    expect(scheduler.getConfig().stats.todayFreeRequests).toBe(1);
  });
});

// ============================================================================
// 6. 每日重置测试
// ============================================================================

describe("每日重置", () => {
  it("dailyReset 应该重置所有账号状态", async () => {
    const config = createMockConfig({
      accounts: [
        {
          ...createExhaustedAccount("ant-ling"),
          todayUsage: { tokens: 500000, requests: 100, lastUpdated: new Date().toISOString() },
        },
      ],
      stats: {
        todaySavings: 10,
        totalSavings: 100,
        todayFreeRequests: 50,
        lastResetDate: "2020-01-01", // 旧日期，确保触发重置
      },
    });
    const scheduler = new FreeModelScheduler(config);

    await scheduler.dailyReset();

    const account = scheduler.getConfig().accounts[0];
    expect(account.status).toBe("active");
    expect(account.todayUsage.tokens).toBe(0);
    expect(account.todayUsage.requests).toBe(0);
  });

  it("dailyReset 应该重置今日统计", async () => {
    const config = createMockConfig({
      stats: {
        todaySavings: 10,
        totalSavings: 100,
        todayFreeRequests: 50,
        lastResetDate: "2020-01-01",
      },
    });
    const scheduler = new FreeModelScheduler(config);

    await scheduler.dailyReset();

    expect(scheduler.getConfig().stats.todaySavings).toBe(0);
    expect(scheduler.getConfig().stats.todayFreeRequests).toBe(0);
  });

  it("dailyReset 应该保留历史总计", async () => {
    const config = createMockConfig({
      stats: {
        todaySavings: 10,
        totalSavings: 100,
        todayFreeRequests: 50,
        lastResetDate: "2020-01-01",
      },
    });
    const scheduler = new FreeModelScheduler(config);

    await scheduler.dailyReset();

    expect(scheduler.getConfig().stats.totalSavings).toBe(100);
  });

  it("同一天多次调用 dailyReset 不应该重复重置", async () => {
    const today = new Date().toISOString().split("T")[0];
    const config = createMockConfig({
      stats: {
        todaySavings: 10,
        totalSavings: 100,
        todayFreeRequests: 50,
        lastResetDate: today,
      },
    });
    const scheduler = new FreeModelScheduler(config);

    await scheduler.dailyReset();

    // 今日统计应该保持不变
    expect(scheduler.getConfig().stats.todaySavings).toBe(10);
  });
});

// ============================================================================
// 7. 账号管理测试
// ============================================================================

describe("账号管理", () => {
  it("removeAccount 应该删除账号", async () => {
    const config = createMockConfig();
    const scheduler = new FreeModelScheduler(config);

    await scheduler.removeAccount("ant-ling");

    expect(scheduler.getConfig().accounts.length).toBe(1);
    expect(scheduler.getConfig().accounts[0].providerId).toBe("meituan-longcat");
  });

  it("removeAccount 后应该重新计算优先级", async () => {
    const config = createMockConfig();
    const scheduler = new FreeModelScheduler(config);

    await scheduler.removeAccount("ant-ling");

    expect(scheduler.getConfig().accounts[0].priority).toBe(1);
  });

  it("删除所有账号后应该禁用功能", async () => {
    const config = createMockConfig({
      accounts: [
        {
          providerId: "ant-ling",
          apiKey: "sk-test",
          enabled: true,
          priority: 1,
          todayUsage: { tokens: 0, requests: 0, lastUpdated: new Date().toISOString() },
          status: "active",
        },
      ],
    });
    const scheduler = new FreeModelScheduler(config);

    await scheduler.removeAccount("ant-ling");

    expect(scheduler.getConfig().enabled).toBe(false);
  });

  it("reorderAccounts 应该调整优先级", async () => {
    const config = createMockConfig();
    const scheduler = new FreeModelScheduler(config);

    await scheduler.reorderAccounts(["meituan-longcat", "ant-ling"]);

    const accounts = scheduler.getConfig().accounts;
    expect(accounts[0].providerId).toBe("meituan-longcat");
    expect(accounts[0].priority).toBe(1);
    expect(accounts[1].providerId).toBe("ant-ling");
    expect(accounts[1].priority).toBe(2);
  });
});

// ============================================================================
// 8. 配置更新测试
// ============================================================================

describe("配置更新", () => {
  it("updateConfig 应该更新配置", () => {
    const config = createMockConfig();
    const scheduler = new FreeModelScheduler(config);

    const newConfig = createMockConfig({ enabled: false });
    scheduler.updateConfig(newConfig);

    expect(scheduler.getConfig().enabled).toBe(false);
  });

  it("getConfig 应该返回当前配置", () => {
    const config = createMockConfig();
    const scheduler = new FreeModelScheduler(config);

    const returned = scheduler.getConfig();
    expect(returned).toBe(config);
  });
});

// ============================================================================
// 9. 边界情况测试
// ============================================================================

describe("边界情况", () => {
  it("不存在的 providerId 应该安全处理", async () => {
    const config = createMockConfig();
    const scheduler = new FreeModelScheduler(config);

    // 不应该抛出异常
    await scheduler.updateUsage("unknown-provider", 1000);
    await scheduler.removeAccount("unknown-provider");
  });

  it("空错误消息应该安全处理", () => {
    const scheduler = new FreeModelScheduler(createMockConfig());
    const result = scheduler.detectQuotaError("ant-ling", 200, {});

    expect(result.isQuotaError).toBe(false);
  });

  it("getAvailableAccounts 应该返回可用账号", () => {
    const config = createMockConfig();
    const scheduler = new FreeModelScheduler(config);

    const available = scheduler.getAvailableAccounts();
    expect(available.length).toBe(2);
  });
});
