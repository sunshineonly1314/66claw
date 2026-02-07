/**
 * ClawdbotCN 独家福利：每日免费大模型平滑切换工具
 * Gateway API 接口
 */

import type { GatewayRequestHandlers } from "./types.js";
import { loadConfig, writeConfigFile } from "../../config/config.js";
import {
  FREE_MODEL_PROVIDERS,
  getAllFreeModelProviders,
  getFreeModelProvider,
} from "../../config/free-model-providers.js";
import type {
  FreeModelsConfig,
  FreeModelAccount,
} from "../../config/types.free-models.js";
import { DEFAULT_FREE_MODELS_CONFIG } from "../../config/types.free-models.js";
import {
  FreeModelScheduler,
  createFreeModelScheduler,
} from "../../agents/free-model-scheduler.js";

// 调度器实例缓存
let schedulerInstance: FreeModelScheduler | undefined;

/**
 * 获取或创建调度器实例
 */
async function getScheduler(): Promise<FreeModelScheduler> {
  if (!schedulerInstance) {
    const config = await loadFreeModelsConfig();
    schedulerInstance = createFreeModelScheduler(config, saveFreeModelsConfig);
  }
  return schedulerInstance;
}

/**
 * 加载免费模型配置
 */
async function loadFreeModelsConfig(): Promise<FreeModelsConfig> {
  try {
    const config = await loadConfig();
    const freeModels = (config as { freeModels?: FreeModelsConfig }).freeModels ?? {
      ...DEFAULT_FREE_MODELS_CONFIG,
    };

    // 确保每个账户都有完整的字段（数据迁移/补全）
    if (freeModels.accounts) {
      freeModels.accounts = freeModels.accounts.map((account) => ({
        ...account,
        // 确保 enabled 字段存在，默认为 true
        enabled: account.enabled ?? true,
        // 确保 status 字段存在，默认为 active
        status: account.status ?? "active",
        // 确保 todayUsage 字段存在
        todayUsage: account.todayUsage ?? {
          tokens: 0,
          requests: 0,
          lastUpdated: new Date().toISOString(),
        },
      }));
    }

    return freeModels;
  } catch {
    return { ...DEFAULT_FREE_MODELS_CONFIG };
  }
}

/**
 * 保存免费模型配置
 */
async function saveFreeModelsConfig(
  freeModelsConfig: FreeModelsConfig
): Promise<void> {
  const config = await loadConfig();
  (config as { freeModels?: FreeModelsConfig }).freeModels = freeModelsConfig;
  await writeConfigFile(config);

  // 更新调度器实例
  if (schedulerInstance) {
    schedulerInstance.updateConfig(freeModelsConfig);
  }
}

export const freeModelsHandlers: GatewayRequestHandlers = {
  /**
   * 获取所有可用的免费模型 Provider 列表（内置配置）
   */
  "freeModels.providers": async ({ respond }) => {
    const providers = getAllFreeModelProviders().map((p) => ({
      id: p.id,
      name: p.name,
      displayName: p.displayName,
      baseUrl: p.baseUrl,
      models: p.models,
      defaultModel: p.defaultModel,
      freeQuota: p.freeQuota,
      registerUrl: p.registerUrl,
      docsUrl: p.docsUrl,
      features: p.features,
      recommended: p.recommended,
    }));

    respond(true, { providers });
  },

  /**
   * 获取用户配置
   */
  "freeModels.config.get": async ({ respond }) => {
    const config = await loadFreeModelsConfig();

    // 不返回 API 密钥明文，只返回掩码
    const safeConfig = {
      ...config,
      accounts: config.accounts.map((a) => ({
        ...a,
        apiKey: maskApiKey(a.apiKey),
      })),
    };

    // configured 表示用户是否已配置过（有账号或启用过）
    const configured = config.accounts.length > 0 || config.enabled;

    respond(true, { configured, config: safeConfig });
  },

  /**
   * 更新配置（启用/禁用、调度策略等）
   */
  "freeModels.config.update": async ({ params, respond }) => {
    const scheduler = await getScheduler();
    const currentConfig = scheduler.getConfig();

    const updates = params as Partial<FreeModelsConfig>;

    // 只更新允许的字段
    if (typeof updates.enabled === "boolean") {
      currentConfig.enabled = updates.enabled;
    }
    if (updates.scheduling) {
      currentConfig.scheduling = {
        ...currentConfig.scheduling,
        ...updates.scheduling,
      };
    }

    await saveFreeModelsConfig(currentConfig);
    respond(true, { success: true });
  },

  /**
   * 添加免费模型账号
   */
  "freeModels.account.add": async ({ params, respond }) => {
    const { providerId, apiKey } = params as {
      providerId: string;
      apiKey: string;
    };

    if (!providerId || !apiKey) {
      respond(true, {
        success: false,
        error: "缺少必要参数",
      });
      return;
    }

    // 检查 Provider 是否存在
    const provider = getFreeModelProvider(providerId);
    if (!provider) {
      respond(true, {
        success: false,
        error: "未知的模型提供商",
      });
      return;
    }

    const scheduler = await getScheduler();
    const result = await scheduler.addAccount(providerId, apiKey);

    respond(true, result);
  },

  /**
   * 删除免费模型账号
   */
  "freeModels.account.remove": async ({ params, respond }) => {
    const { providerId } = params as { providerId: string };

    if (!providerId) {
      respond(true, {
        success: false,
        error: "缺少必要参数",
      });
      return;
    }

    const scheduler = await getScheduler();
    await scheduler.removeAccount(providerId);

    respond(true, { success: true });
  },

  /**
   * 测试 API 密钥
   */
  "freeModels.account.test": async ({ params, respond }) => {
    const { providerId, apiKey } = params as {
      providerId: string;
      apiKey: string;
    };

    if (!providerId || !apiKey) {
      respond(true, {
        valid: false,
        error: "缺少必要参数",
      });
      return;
    }

    const scheduler = await getScheduler();
    const result = await scheduler.validateApiKey(providerId, apiKey);

    respond(true, result);
  },

  /**
   * 调整优先级
   */
  "freeModels.account.reorder": async ({ params, respond }) => {
    const { order } = params as { order: string[] };

    if (!order || !Array.isArray(order)) {
      respond(true, {
        success: false,
        error: "缺少必要参数",
      });
      return;
    }

    const scheduler = await getScheduler();
    await scheduler.reorderAccounts(order);

    respond(true, { success: true });
  },

  /**
   * 获取统计数据
   */
  "freeModels.stats": async ({ respond }) => {
    const scheduler = await getScheduler();
    const config = scheduler.getConfig();

    respond(true, {
      stats: config.stats,
      switchHistory: config.switchHistory.slice(0, 20), // 只返回最近 20 条
    });
  },

  /**
   * 手动触发每日重置
   */
  "freeModels.dailyReset": async ({ respond }) => {
    const scheduler = await getScheduler();
    await scheduler.dailyReset();

    respond(true, { success: true });
  },

  /**
   * 获取当前最优的免费模型
   */
  "freeModels.current": async ({ respond }) => {
    const scheduler = await getScheduler();
    const account = scheduler.selectBestAccount();

    if (!account) {
      respond(true, {
        available: false,
        reason: "没有可用的免费模型",
      });
      return;
    }

    const provider = getFreeModelProvider(account.providerId);

    respond(true, {
      available: true,
      provider: {
        id: account.providerId,
        name: provider?.name ?? account.providerId,
        displayName: provider?.displayName ?? account.providerId,
        baseUrl: provider?.baseUrl,
        model: provider?.defaultModel,
      },
      todayUsage: account.todayUsage,
    });
  },

  /**
   * 诊断免费模型配置问题
   * 返回详细的诊断信息，帮助排查问题
   */
  "freeModels.diagnose": async ({ respond }) => {
    const config = await loadFreeModelsConfig();
    const scheduler = await getScheduler();
    
    const issues: string[] = [];
    const warnings: string[] = [];
    const info: string[] = [];

    // 检查主开关
    if (!config.enabled) {
      issues.push("❌ 免费模型功能未启用 (freeModels.enabled = false)");
    } else {
      info.push("✅ 免费模型功能已启用");
    }

    // 检查账号配置
    if (config.accounts.length === 0) {
      issues.push("❌ 未配置任何免费模型账号");
    } else {
      info.push(`📋 已配置 ${config.accounts.length} 个免费模型账号`);
      
      let activeCount = 0;
      for (const account of config.accounts) {
        const provider = getFreeModelProvider(account.providerId);
        const providerName = provider?.name ?? account.providerId;
        
        // 检查 enabled 字段
        if (account.enabled === false) {
          issues.push(`❌ ${providerName}: 账号已手动禁用 (enabled = false)`);
          continue;
        }
        if (account.enabled === undefined) {
          warnings.push(`⚠️ ${providerName}: enabled 字段缺失，将默认为 true`);
        }
        
        // 检查 status 字段
        if (account.status === undefined) {
          issues.push(`❌ ${providerName}: status 字段缺失，需要重新配置`);
        } else if (account.status === "active") {
          info.push(`✅ ${providerName}: 状态正常 (active)`);
          activeCount++;
        } else if (account.status === "exhausted") {
          warnings.push(`⏸️ ${providerName}: 今日额度已用尽，将在明日重置`);
        } else if (account.status === "error") {
          issues.push(`❌ ${providerName}: 账号错误 - ${account.lastError ?? "未知错误"}`);
        } else if (account.status === "disabled") {
          issues.push(`❌ ${providerName}: 账号已禁用`);
        } else {
          issues.push(`❌ ${providerName}: 状态异常 (status = ${account.status})`);
        }
        
        // 检查 todayUsage 字段
        if (!account.todayUsage) {
          warnings.push(`⚠️ ${providerName}: todayUsage 字段缺失`);
        }
        
        // 检查 API Key
        if (!account.apiKey || account.apiKey.length < 10) {
          issues.push(`❌ ${providerName}: API Key 无效或过短`);
        }
      }
      
      if (activeCount === 0 && config.accounts.length > 0) {
        issues.push("❌ 没有可用的活跃账号 (所有账号都处于非 active 状态)");
      } else {
        info.push(`🎯 ${activeCount} 个账号可用于聊天`);
      }
    }

    // 尝试选择最优账号
    const bestAccount = scheduler.selectBestAccount();
    if (bestAccount) {
      const provider = getFreeModelProvider(bestAccount.providerId);
      info.push(`🏆 当前首选账号: ${provider?.name ?? bestAccount.providerId}`);
    } else if (config.enabled && config.accounts.length > 0) {
      issues.push("❌ 无法选择可用账号，请检查上述问题");
    }

    // 检查统计数据
    info.push(`📊 今日免费调用: ${config.stats?.todayFreeRequests ?? 0} 次`);
    info.push(`💰 今日节省: ¥${(config.stats?.todaySavings ?? 0).toFixed(2)}`);
    info.push(`💎 累计节省: ¥${(config.stats?.totalSavings ?? 0).toFixed(2)}`);

    // 生成诊断结论
    const healthy = issues.length === 0;
    const summary = healthy
      ? "✅ 免费模型配置正常，可正常使用"
      : `⚠️ 发现 ${issues.length} 个问题需要修复`;

    respond(true, {
      healthy,
      summary,
      issues,
      warnings,
      info,
      rawConfig: {
        enabled: config.enabled,
        accountCount: config.accounts.length,
        accounts: config.accounts.map((a) => ({
          providerId: a.providerId,
          enabled: a.enabled,
          status: a.status,
          priority: a.priority,
          hasApiKey: !!a.apiKey && a.apiKey.length > 10,
          todayUsage: a.todayUsage,
          lastError: a.lastError,
        })),
      },
    });
  },

  /**
   * 修复免费模型配置
   * 自动修复常见的配置问题
   */
  "freeModels.repair": async ({ respond }) => {
    const config = await loadFreeModelsConfig();
    let repaired = false;
    const repairs: string[] = [];

    for (const account of config.accounts) {
      const provider = getFreeModelProvider(account.providerId);
      const providerName = provider?.name ?? account.providerId;

      // 修复 enabled 字段
      if (account.enabled === undefined) {
        account.enabled = true;
        repairs.push(`${providerName}: 设置 enabled = true`);
        repaired = true;
      }

      // 修复 status 字段
      const validStatuses = ["active", "exhausted", "error", "disabled"];
      if (!account.status || !validStatuses.includes(account.status)) {
        account.status = "active";
        repairs.push(`${providerName}: 设置 status = "active"`);
        repaired = true;
      }

      // 修复 todayUsage 字段
      if (!account.todayUsage) {
        account.todayUsage = {
          tokens: 0,
          requests: 0,
          lastUpdated: new Date().toISOString(),
        };
        repairs.push(`${providerName}: 初始化 todayUsage`);
        repaired = true;
      }

      // 修复 priority 字段
      if (typeof account.priority !== "number") {
        account.priority = config.accounts.indexOf(account) + 1;
        repairs.push(`${providerName}: 设置 priority = ${account.priority}`);
        repaired = true;
      }
    }

    if (repaired) {
      await saveFreeModelsConfig(config);
    }

    respond(true, {
      repaired,
      repairs,
      message: repaired
        ? `✅ 已修复 ${repairs.length} 个配置问题`
        : "✅ 配置无需修复",
    });
  },
};

/**
 * API 密钥掩码
 */
function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) {
    return "****";
  }
  return apiKey.slice(0, 4) + "****" + apiKey.slice(-4);
}

/**
 * 导出调度器获取函数（供其他模块使用）
 */
export { getScheduler };
