/**
 * ClawdbotCN 独家福利：每日免费大模型平滑切换工具
 * 免费模型调度器
 */

import type {
  FreeModelsConfig,
  FreeModelAccount,
  FreeModelSwitchNotification,
  QuotaCheckResult,
  FreeModelSwitchRecord,
} from "../config/types.free-models.js";
import {
  FREE_MODEL_PROVIDERS,
  getFreeModelProvider,
  QUOTA_ERROR_KEYWORDS_CHINESE,
  QUOTA_ERROR_KEYWORDS_ENGLISH,
  ESTIMATED_PRICE_PER_1K_TOKENS,
} from "../config/free-model-providers.js";
import { getBeijingDateString } from "../config/free-models-time.js";

/**
 * 免费模型调度器
 * 负责选择最优模型、检测额度不足、触发切换
 */
export class FreeModelScheduler {
  private config: FreeModelsConfig;
  private onConfigChange?: (config: FreeModelsConfig) => Promise<void>;

  constructor(
    config: FreeModelsConfig,
    onConfigChange?: (config: FreeModelsConfig) => Promise<void>
  ) {
    this.config = config;
    this.onConfigChange = onConfigChange;
  }

  /**
   * 更新配置
   */
  updateConfig(config: FreeModelsConfig): void {
    this.config = config;
  }

  /**
   * 获取当前可用的免费模型账号
   */
  getAvailableAccounts(): FreeModelAccount[] {
    return this.config.accounts
      .filter((a) => a.enabled && a.status === "active")
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * 选择最优的免费模型
   */
  selectBestAccount(): FreeModelAccount | undefined {
    const available = this.getAvailableAccounts();
    if (available.length === 0) {
      return undefined;
    }

    if (this.config.scheduling.strategy === "round_robin") {
      // 轮询策略：选择使用次数最少的
      return available.sort(
        (a, b) => a.todayUsage.requests - b.todayUsage.requests
      )[0];
    }

    // 优先级策略：直接返回第一个（已按优先级排序）
    return available[0];
  }

  /**
   * 检测错误是否为额度不足
   */
  detectQuotaError(
    providerId: string,
    httpStatus: number,
    responseBody: unknown
  ): QuotaCheckResult {
    const provider = getFreeModelProvider(providerId);
    let confidence: "high" | "medium" | "low" = "low";
    let isQuotaError = false;
    let reason: QuotaCheckResult["reason"] = "unknown";

    // Layer 1: HTTP 状态码
    if (provider?.errorCodes.httpStatus?.includes(httpStatus)) {
      confidence = "medium";
      if (httpStatus === 402) {
        reason = "balance";
      } else if (httpStatus === 429) {
        reason = "rate_limit";
      }
    }

    // Layer 2: Provider 特定错误码
    if (provider?.errorCodes) {
      const errorCode = this.extractErrorCode(
        responseBody,
        provider.errorCodes.codeField
      );

      if (errorCode !== undefined) {
        // 检查数字错误码
        if (
          typeof errorCode === "number" &&
          provider.errorCodes.numericCodes?.includes(errorCode)
        ) {
          isQuotaError = true;
          confidence = "high";
          reason = "daily_limit";
        }

        // 检查字符串错误码
        if (
          typeof errorCode === "string" &&
          provider.errorCodes.stringCodes?.includes(errorCode.toLowerCase())
        ) {
          isQuotaError = true;
          confidence = "high";
          reason = "daily_limit";
        }
      }
    }

    // Layer 3: 错误消息关键词匹配
    const errorMessage = this.extractErrorMessage(responseBody);
    if (errorMessage) {
      const matchesChinese = QUOTA_ERROR_KEYWORDS_CHINESE.some((kw) =>
        errorMessage.includes(kw)
      );
      const matchesEnglish = QUOTA_ERROR_KEYWORDS_ENGLISH.some((kw) =>
        errorMessage.toLowerCase().includes(kw.toLowerCase())
      );

      if (matchesChinese || matchesEnglish) {
        isQuotaError = true;
        if (confidence === "medium") {
          confidence = "high";
        } else if (confidence === "low") {
          confidence = "medium";
        }
        reason = "daily_limit";
      }
    }

    return {
      isQuotaError,
      provider: providerId,
      reason,
      confidence,
      originalError: responseBody,
    };
  }

  /**
   * 处理额度不足，切换到下一个模型
   */
  async handleQuotaExhausted(
    currentProviderId: string
  ): Promise<{
    nextAccount: FreeModelAccount | undefined;
    notification: FreeModelSwitchNotification;
  }> {
    // 标记当前账号为已用尽
    await this.markAccountExhausted(currentProviderId);

    // 选择下一个可用账号
    const nextAccount = this.selectBestAccount();
    const currentProvider = getFreeModelProvider(currentProviderId);

    if (nextAccount) {
      const nextProvider = getFreeModelProvider(nextAccount.providerId);

      // 计算节省金额（估算）
      const savings = this.estimateSavings(1000); // 假设每次请求 1000 tokens

      // 记录切换历史
      await this.recordSwitch(currentProviderId, nextAccount.providerId, savings);

      return {
        nextAccount,
        notification: {
          type: "switch",
          fromProvider: currentProvider?.name ?? currentProviderId,
          toProvider: nextProvider?.name ?? nextAccount.providerId,
          reason: "quota_exhausted",
          message: `${currentProvider?.name ?? currentProviderId}今日额度已用完，已自动切换到 ${nextProvider?.name ?? nextAccount.providerId} (每日免费) 继续运行`,
          savings,
          todaySavings: this.config.stats.todaySavings + savings,
        },
      };
    }

    // 所有免费模型都用完了
    return {
      nextAccount: undefined,
      notification: {
        type: "all_exhausted",
        fromProvider: currentProvider?.name ?? currentProviderId,
        reason: "all_exhausted",
        message: "今日免费额度已全部用完，请配置付费模型或等待明日 00:00 额度重置",
        todaySavings: this.config.stats.todaySavings,
      },
    };
  }

  /**
   * 标记账号为已用尽
   */
  private async markAccountExhausted(providerId: string): Promise<void> {
    const account = this.config.accounts.find(
      (a) => a.providerId === providerId
    );
    if (account) {
      account.status = "exhausted";
      account.lastError = "今日额度已用完";
      account.lastErrorTime = new Date().toISOString();
      await this.saveConfig();
    }
  }

  /**
   * 记录切换历史
   */
  private async recordSwitch(
    fromProvider: string,
    toProvider: string,
    savings: number
  ): Promise<void> {
    const record: FreeModelSwitchRecord = {
      timestamp: new Date().toISOString(),
      fromProvider,
      toProvider,
      reason: "quota_exhausted",
      savings,
    };

    this.config.switchHistory.unshift(record);

    // 只保留最近 50 条记录
    if (this.config.switchHistory.length > 50) {
      this.config.switchHistory = this.config.switchHistory.slice(0, 50);
    }

    // 更新统计
    this.config.stats.todaySavings += savings;
    this.config.stats.totalSavings += savings;

    await this.saveConfig();
  }

  /**
   * 更新使用统计
   */
  async updateUsage(providerId: string, tokens: number): Promise<void> {
    const account = this.config.accounts.find(
      (a) => a.providerId === providerId
    );
    if (account) {
      account.todayUsage.tokens += tokens;
      account.todayUsage.requests += 1;
      account.todayUsage.lastUpdated = new Date().toISOString();

      this.config.stats.todayFreeRequests += 1;

      await this.saveConfig();
    }
  }

  /**
   * 每日重置（应在 00:00 调用）
   */
  async dailyReset(): Promise<void> {
    const today = getBeijingDateString();

    if (this.config.stats.lastResetDate !== today) {
      // 重置所有账号状态
      for (const account of this.config.accounts) {
        account.todayUsage = {
          tokens: 0,
          requests: 0,
          lastUpdated: new Date().toISOString(),
        };
        if (account.status === "exhausted") {
          account.status = "active";
          account.lastError = undefined;
          account.lastErrorTime = undefined;
        }
      }

      // 重置今日统计
      this.config.stats.todaySavings = 0;
      this.config.stats.todayFreeRequests = 0;
      this.config.stats.lastResetDate = today;

      await this.saveConfig();
    }
  }

  /**
   * 估算节省金额
   */
  private estimateSavings(tokens: number): number {
    return (tokens / 1000) * ESTIMATED_PRICE_PER_1K_TOKENS;
  }

  /**
   * 从响应中提取错误码
   */
  private extractErrorCode(
    body: unknown,
    fieldPath?: string
  ): string | number | undefined {
    if (!body || typeof body !== "object") return undefined;
    if (!fieldPath) return (body as Record<string, unknown>).code as string | number | undefined;

    const parts = fieldPath.split(".");
    let current: unknown = body;

    for (const part of parts) {
      if (current && typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current as string | number | undefined;
  }

  /**
   * 从响应中提取错误消息
   */
  private extractErrorMessage(body: unknown): string | undefined {
    if (!body || typeof body !== "object") return undefined;

    const obj = body as Record<string, unknown>;

    // 尝试多种常见的错误消息字段
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.msg === "string") return obj.msg;
    if (typeof obj.error === "string") return obj.error;
    if (obj.error && typeof obj.error === "object") {
      const errorObj = obj.error as Record<string, unknown>;
      if (typeof errorObj.message === "string") return errorObj.message;
      if (typeof errorObj.msg === "string") return errorObj.msg;
    }

    // 尝试将整个对象转为字符串
    try {
      return JSON.stringify(body);
    } catch {
      return undefined;
    }
  }

  /**
   * 验证并修复配置完整性
   * 确保所有账号都有必要的字段
   */
  private ensureConfigIntegrity(): void {
    // 确保 accounts 数组存在
    if (!this.config.accounts) {
      this.config.accounts = [];
    }

    // 验证并修复每个账号的字段
    for (const account of this.config.accounts) {
      // 确保 enabled 字段存在
      if (typeof account.enabled !== "boolean") {
        account.enabled = true;
      }
      
      // 确保 status 字段存在且有效
      const validStatuses = ["active", "exhausted", "error", "disabled"];
      if (!account.status || !validStatuses.includes(account.status)) {
        account.status = "active";
      }
      
      // 确保 todayUsage 字段存在
      if (!account.todayUsage) {
        account.todayUsage = {
          tokens: 0,
          requests: 0,
          lastUpdated: new Date().toISOString(),
        };
      }
      
      // 确保 priority 字段存在
      if (typeof account.priority !== "number") {
        account.priority = this.config.accounts.indexOf(account) + 1;
      }
    }

    // 确保 scheduling 字段存在
    if (!this.config.scheduling) {
      this.config.scheduling = {
        strategy: "priority",
        showNotification: true,
        preCheck: true,
      };
    }

    // 确保 stats 字段存在
    if (!this.config.stats) {
      this.config.stats = {
        todaySavings: 0,
        totalSavings: 0,
        todayFreeRequests: 0,
        lastResetDate: getBeijingDateString(),
      };
    }

    // 确保 switchHistory 字段存在
    if (!this.config.switchHistory) {
      this.config.switchHistory = [];
    }
  }

  /**
   * 保存配置
   */
  private async saveConfig(): Promise<void> {
    // 保存前确保配置完整性
    this.ensureConfigIntegrity();
    
    if (this.onConfigChange) {
      await this.onConfigChange(this.config);
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): FreeModelsConfig {
    // 获取前也确保配置完整性
    this.ensureConfigIntegrity();
    return this.config;
  }

  /**
   * 验证 API 密钥
   */
  async validateApiKey(
    providerId: string,
    apiKey: string
  ): Promise<{ valid: boolean; error?: string }> {
    const provider = getFreeModelProvider(providerId);
    if (!provider) {
      return { valid: false, error: "未知的 Provider" };
    }

    try {
      // 发送一个简单的测试请求
      const response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: provider.defaultModel,
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5,
        }),
      });

      if (response.ok) {
        return { valid: true };
      }

      const body = await response.json().catch(() => ({}));
      const errorMessage = this.extractErrorMessage(body);

      // 检查是否是认证错误
      if (response.status === 401 || response.status === 403) {
        return { valid: false, error: "API 密钥无效或已过期" };
      }

      // 其他错误可能是正常的（比如额度问题），但至少说明密钥格式正确
      if (response.status === 429 || response.status === 402) {
        return { valid: true }; // 密钥有效，只是额度问题
      }

      return { valid: false, error: errorMessage ?? `HTTP ${response.status}` };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "网络错误",
      };
    }
  }

  /**
   * 添加或更新免费模型账号
   * 如果账号已存在，则更新 API Key 并重置状态
   */
  async addAccount(
    providerId: string,
    apiKey: string
  ): Promise<{ success: boolean; error?: string }> {
    // 验证 API 密钥
    const validation = await this.validateApiKey(providerId, apiKey);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // 检查是否已存在
    const existingIndex = this.config.accounts.findIndex(
      (a) => a.providerId === providerId
    );

    if (existingIndex >= 0) {
      // 更新现有账号的 API Key 并重置状态
      const existing = this.config.accounts[existingIndex];
      existing.apiKey = apiKey;
      existing.enabled = true;
      existing.status = "active";
      existing.lastError = undefined;
      existing.lastErrorTime = undefined;
    } else {
      // 添加新账号
      const newAccount: FreeModelAccount = {
        providerId,
        apiKey,
        enabled: true,
        priority: this.config.accounts.length + 1,
        todayUsage: {
          tokens: 0,
          requests: 0,
          lastUpdated: new Date().toISOString(),
        },
        status: "active",
      };
      this.config.accounts.push(newAccount);
    }

    this.config.enabled = true;
    await this.saveConfig();

    return { success: true };
  }

  /**
   * 删除账号
   */
  async removeAccount(providerId: string): Promise<void> {
    this.config.accounts = this.config.accounts.filter(
      (a) => a.providerId !== providerId
    );

    // 重新计算优先级
    this.config.accounts.forEach((a, i) => {
      a.priority = i + 1;
    });

    // 如果没有账号了，禁用功能
    if (this.config.accounts.length === 0) {
      this.config.enabled = false;
    }

    await this.saveConfig();
  }

  /**
   * 调整优先级
   */
  async reorderAccounts(providerIds: string[]): Promise<void> {
    const newAccounts: FreeModelAccount[] = [];

    for (let i = 0; i < providerIds.length; i++) {
      const account = this.config.accounts.find(
        (a) => a.providerId === providerIds[i]
      );
      if (account) {
        account.priority = i + 1;
        newAccounts.push(account);
      }
    }

    this.config.accounts = newAccounts;
    await this.saveConfig();
  }
}

/**
 * 创建调度器实例
 */
export function createFreeModelScheduler(
  config: FreeModelsConfig,
  onConfigChange?: (config: FreeModelsConfig) => Promise<void>
): FreeModelScheduler {
  return new FreeModelScheduler(config, onConfigChange);
}
