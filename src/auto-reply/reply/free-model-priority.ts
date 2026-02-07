/**
 * ClawdbotCN 专属功能：免费模型优先级检查
 * 在聊天时优先使用配置的免费模型
 */

import { loadConfig, type ClawdbotConfig } from "../../config/config.js";
import type { FreeModelsConfig, FreeModelAccount } from "../../config/types.free-models.js";
import { DEFAULT_FREE_MODELS_CONFIG } from "../../config/types.free-models.js";
import { getFreeModelProvider, type FreeModelProvider } from "../../config/free-model-providers.js";
import { getBeijingDateString } from "../../config/free-models-time.js";
import type { ModelProviderConfig } from "../../config/types.models.js";

/** 免费模型通知类型 */
export type FreeModelNotificationType =
  | "started"      // 开始使用免费模型
  | "switched"     // 切换到另一个免费模型
  | "exhausted"    // 所有免费模型额度用尽
  | "fallback";    // 回退到付费模型

/** 免费模型通知 */
export interface FreeModelNotification {
  type: FreeModelNotificationType;
  providerName: string;
  message: string;
  /** 是否在 UI 中显示 */
  showInChat: boolean;
}

/** 免费模型检查结果 */
export interface FreeModelCheckResult {
  /** 是否使用免费模型 */
  useFreeModel: boolean;
  /** 免费模型的 provider ID（用于配置注入） */
  providerId?: string;
  /** 免费模型的 model 名称 */
  model?: string;
  /** 免费模型的 baseUrl */
  baseUrl?: string;
  /** API Key */
  apiKey?: string;
  /** 通知信息 */
  notification?: FreeModelNotification;
  /** 原始账户信息 */
  account?: FreeModelAccount;
  /** Provider 配置信息 */
  providerConfig?: FreeModelProvider;
  /** 调试信息（仅内部使用） */
  _debug?: {
    reason: string;
    diagnosis?: {
      enabled: boolean;
      totalAccounts: number;
      activeAccounts: number;
      issues: string[];
    };
  };
}

// 缓存上一次使用的免费模型，按 session key 存储以避免并发竞态
// 注意：这是进程内缓存，重启后会丢失，但通知只是 UX 优化，不影响功能
const lastUsedFreeModelBySession = new Map<string, string>();

// 默认 session key，用于无法确定 session 的场景
const DEFAULT_SESSION_KEY = "__default__";

/**
 * 获取上次使用的免费模型 Provider ID
 */
function getLastUsedProvider(sessionKey?: string): string | undefined {
  return lastUsedFreeModelBySession.get(sessionKey ?? DEFAULT_SESSION_KEY);
}

/**
 * 设置上次使用的免费模型 Provider ID
 */
function setLastUsedProvider(sessionKey: string | undefined, providerId: string | undefined): void {
  const key = sessionKey ?? DEFAULT_SESSION_KEY;
  if (providerId) {
    lastUsedFreeModelBySession.set(key, providerId);
  } else {
    lastUsedFreeModelBySession.delete(key);
  }
}

// 兼容旧代码的全局变量（已废弃，仅用于向后兼容）
let lastUsedFreeModelProvider: string | undefined;

/**
 * 加载免费模型配置
 */
async function loadFreeModelsConfig(): Promise<FreeModelsConfig> {
  try {
    const config = await loadConfig();
    const freeModels = (config as { freeModels?: FreeModelsConfig }).freeModels;
    if (!freeModels) {
      return { ...DEFAULT_FREE_MODELS_CONFIG };
    }
    // 数据迁移/补全：确保每个账户都有完整的字段
    if (freeModels.accounts) {
      freeModels.accounts = freeModels.accounts.map((account) => ({
        ...account,
        enabled: account.enabled ?? true,
        status: account.status ?? "active",
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
 * 获取可用的免费模型账户
 */
function getAvailableAccounts(config: FreeModelsConfig): FreeModelAccount[] {
  return config.accounts
    .filter((a) => a.enabled && a.status === "active")
    .sort((a, b) => a.priority - b.priority);
}

/**
 * 选择最优的免费模型账户
 */
function selectBestAccount(config: FreeModelsConfig): FreeModelAccount | undefined {
  const available = getAvailableAccounts(config);
  if (available.length === 0) {
    return undefined;
  }

  if (config.scheduling.strategy === "round_robin") {
    // 轮询策略：选择使用次数最少的
    // 防御性编程：确保 todayUsage 存在
    return [...available].sort((a, b) => {
      const aRequests = a.todayUsage?.requests ?? 0;
      const bRequests = b.todayUsage?.requests ?? 0;
      return aRequests - bRequests;
    })[0];
  }

  // 优先级策略：直接返回第一个（已按优先级排序）
  return available[0];
}

/**
 * 诊断免费模型配置状态，返回详细的诊断信息
 * 用于调试和日志输出
 */
export function diagnoseFreeModelConfig(config: FreeModelsConfig): {
  enabled: boolean;
  totalAccounts: number;
  activeAccounts: number;
  issues: string[];
} {
  const issues: string[] = [];
  
  if (!config.enabled) {
    issues.push("免费模型功能未启用 (enabled=false)");
  }
  
  if (config.accounts.length === 0) {
    issues.push("未配置任何免费模型账号");
  } else {
    for (const account of config.accounts) {
      const providerName = getFreeModelProvider(account.providerId)?.name ?? account.providerId;
      if (!account.enabled) {
        issues.push(`${providerName}: 账号已手动禁用 (enabled=false)`);
      } else if (account.status === "exhausted") {
        issues.push(`${providerName}: 今日额度已用尽 (status=exhausted)`);
      } else if (account.status === "error") {
        issues.push(`${providerName}: 账号异常 (status=error, error=${account.lastError ?? "unknown"})`);
      } else if (account.status === "disabled") {
        issues.push(`${providerName}: 账号被禁用 (status=disabled)`);
      } else if (account.status !== "active") {
        issues.push(`${providerName}: 状态异常 (status=${account.status ?? "undefined"})`);
      }
    }
  }
  
  const activeAccounts = config.accounts.filter(
    (a) => a.enabled && a.status === "active"
  ).length;
  
  return {
    enabled: config.enabled,
    totalAccounts: config.accounts.length,
    activeAccounts,
    issues,
  };
}

/**
 * 检查并获取优先使用的免费模型
 * 这是集成到聊天流程的核心函数
 * @param sessionKey 可选的 session key，用于追踪每个会话的模型切换状态
 */
export async function checkFreeModelPriority(sessionKey?: string): Promise<FreeModelCheckResult> {
  const config = await loadFreeModelsConfig();

  // 检查是否需要每日重置
  await checkAndPerformDailyReset(config);

  // 本地额度上限预检：如果某个账号的 token 已达上限，则直接标记为 exhausted，
  // 这样本次请求就不会继续使用它（避免服务端直接返回 401/403 之类的“无 body”错误）。
  await applyLocalDailyTokenLimits(config);

  // 检查功能是否启用
  if (!config.enabled) {
    return { useFreeModel: false, _debug: { reason: "功能未启用" } };
  }

  // 选择最优的免费模型
  const account = selectBestAccount(config);

  // 获取该 session 上次使用的 provider
  const lastUsed = getLastUsedProvider(sessionKey);

  if (!account) {
    // 没有可用的免费模型 - 输出详细诊断信息
    const diagnosis = diagnoseFreeModelConfig(config);
    const debugInfo = {
      reason: "没有可用的免费模型账号",
      diagnosis,
    };
    
    if (lastUsed) {
      // 之前在使用免费模型，现在用完了
      const previousProvider = getFreeModelProvider(lastUsed);
      const previousAccount = config.accounts.find((a) => a.providerId === lastUsed);
      const wasLocalLimited = previousAccount?.lastError?.includes("本地限流") === true;
      setLastUsedProvider(sessionKey, undefined);
      // 同时更新兼容变量
      lastUsedFreeModelProvider = undefined;
      return {
        useFreeModel: false,
        notification: {
          type: "exhausted",
          providerName: previousProvider?.name ?? "",
          message: wasLocalLimited
            ? "ClawdbotCN专属权益：今日免费额度已达到上限（本地限流），已自动切换回付费模型"
            : "ClawdbotCN专属权益：今日免费额度已用完，已自动切换回付费模型",
          showInChat: true,
        },
        _debug: debugInfo,
      };
    }
    return { useFreeModel: false, _debug: debugInfo };
  }

  // 获取 provider 配置
  const providerConfig = getFreeModelProvider(account.providerId);
  if (!providerConfig) {
    return { useFreeModel: false };
  }

  // 构建通知
  let notification: FreeModelNotification | undefined;

  if (!lastUsed) {
    // 首次使用免费模型
    notification = {
      type: "started",
      providerName: providerConfig.name,
      message: `ClawdbotCN专属权益：免费模型 ${providerConfig.name} 已开始使用`,
      showInChat: config.scheduling.showNotification,
    };
  } else if (lastUsed !== account.providerId) {
    // 切换到另一个免费模型
    const previousProvider = getFreeModelProvider(lastUsed);
    const previousAccount = config.accounts.find((a) => a.providerId === lastUsed);
    const wasLocalLimited = previousAccount?.lastError?.includes("本地限流") === true;
    notification = {
      type: "switched",
      providerName: providerConfig.name,
      message: wasLocalLimited
        ? `ClawdbotCN专属权益：${previousProvider?.name ?? lastUsed} 今日 token 已达上限（本地限流），已平滑切换至 ${providerConfig.name}`
        : `ClawdbotCN专属权益：${previousProvider?.name ?? lastUsed} 额度已用完，已平滑切换至 ${providerConfig.name}`,
      showInChat: config.scheduling.showNotification,
    };
  }

  // 更新缓存
  setLastUsedProvider(sessionKey, account.providerId);
  // 同时更新兼容变量
  lastUsedFreeModelProvider = account.providerId;

  // 使用特殊的 provider ID，格式：free-model-{providerId}
  const freeModelProviderId = `free-model-${account.providerId}`;

  return {
    useFreeModel: true,
    providerId: freeModelProviderId,
    model: providerConfig.defaultModel,
    baseUrl: providerConfig.baseUrl,
    apiKey: account.apiKey,
    notification,
    account,
    providerConfig,
  };
}

/**
 * 检查并执行每日重置
 * 在每次检查免费模型时调用，确保 exhausted 状态的账户在新的一天能够恢复
 */
async function checkAndPerformDailyReset(config: FreeModelsConfig): Promise<void> {
  const today = getBeijingDateString();
  
  // 检查是否已经在今天重置过
  if (config.stats.lastResetDate === today) {
    return;
  }

  // 需要执行每日重置
  let needsSave = false;
  
  for (const account of config.accounts) {
    // 重置今日使用统计
    if (account.todayUsage) {
      account.todayUsage.tokens = 0;
      account.todayUsage.requests = 0;
      account.todayUsage.lastUpdated = new Date().toISOString();
    }
    
    // 恢复 exhausted 状态的账户
    if (account.status === "exhausted") {
      account.status = "active";
      account.lastError = undefined;
      account.lastErrorTime = undefined;
      needsSave = true;
    }
  }

  // 重置今日统计
  config.stats.todaySavings = 0;
  config.stats.todayFreeRequests = 0;
  config.stats.lastResetDate = today;
  needsSave = true;

  // 保存配置
  if (needsSave) {
    try {
      const fullConfig = await loadConfig();
      (fullConfig as { freeModels?: FreeModelsConfig }).freeModels = config;
      const { writeConfigFile } = await import("../../config/config.js");
      await writeConfigFile(fullConfig);
    } catch {
      // 忽略保存错误
    }
  }
}

/**
 * 本地额度上限预检（按 Provider 配置的 daily tokens limit）
 *
 * 当今日累计 token >= limit 时，主动把账号标记为 exhausted，避免继续撞服务端鉴权错误。
 * 注意：这里只做“>= limit”的硬阈值判断；token 计数来自运行时 usage 汇总（见 agent-runner）。
 */
async function applyLocalDailyTokenLimits(config: FreeModelsConfig): Promise<void> {
  let needsSave = false;
  const nowIso = new Date().toISOString();

  for (const account of config.accounts) {
    if (!account.enabled) continue;
    if (account.status !== "active") continue;

    const provider = getFreeModelProvider(account.providerId);
    const limit =
      provider?.freeQuota.type === "daily" && provider.freeQuota.unit === "tokens"
        ? provider.freeQuota.limit
        : null;
    if (!limit || limit <= 0) continue;

    const used = account.todayUsage?.tokens ?? 0;
    if (used >= limit) {
      account.status = "exhausted";
      account.lastError = `本地限流：今日已使用 ${used} tokens，达到上限 ${limit} tokens`;
      account.lastErrorTime = nowIso;
      needsSave = true;
    }
  }

  if (!needsSave) return;

  try {
    const fullConfig = await loadConfig();
    (fullConfig as { freeModels?: FreeModelsConfig }).freeModels = config;
    const { writeConfigFile } = await import("../../config/config.js");
    await writeConfigFile(fullConfig);
  } catch {
    // best-effort
  }
}

/**
 * 将免费模型注入到配置中
 * 这允许底层代码自然地使用免费模型
 */
export function injectFreeModelConfig(
  cfg: ClawdbotConfig,
  freeModelResult: FreeModelCheckResult
): ClawdbotConfig {
  if (!freeModelResult.useFreeModel || !freeModelResult.providerConfig) {
    return cfg;
  }

  const { providerId, baseUrl, apiKey, providerConfig } = freeModelResult;
  if (!providerId || !baseUrl || !apiKey) {
    return cfg;
  }

  // 创建免费模型的 provider 配置
  const freeModelProviderConfig: ModelProviderConfig = {
    baseUrl,
    apiKey,
    api: "openai-completions",
    models: providerConfig.models.map((modelId) => ({
      id: modelId,
      name: `${providerConfig.name} ${modelId}`,
      reasoning: false,
      input: ["text"] as Array<"text" | "image" | "video">,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 8192,
    })),
  };

  // 深拷贝配置并注入免费模型 provider
  const modifiedCfg = structuredClone(cfg);
  if (!modifiedCfg.models) {
    modifiedCfg.models = {};
  }
  if (!modifiedCfg.models.providers) {
    modifiedCfg.models.providers = {};
  }
  modifiedCfg.models.providers[providerId] = freeModelProviderConfig;

  return modifiedCfg;
}

/**
 * 生成免费模型通知的聊天消息格式
 * 返回一个特殊格式的字符串，UI 可以识别并渲染为专属权益卡片
 */
export function formatFreeModelNotification(notification: FreeModelNotification): string {
  // 使用特殊标记，让 UI 可以识别
  return `<!--CLAWDBOT_FREE_MODEL_NOTIFICATION:${JSON.stringify(notification)}-->`;
}

/**
 * 解析聊天消息中的免费模型通知
 */
export function parseFreeModelNotification(text: string): FreeModelNotification | null {
  const match = text.match(/<!--CLAWDBOT_FREE_MODEL_NOTIFICATION:(.+?)-->/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as FreeModelNotification;
  } catch {
    return null;
  }
}

/**
 * 重置免费模型状态（用于测试或手动重置）
 */
export function resetFreeModelState(): void {
  lastUsedFreeModelProvider = undefined;
}

/**
 * 获取当前使用的免费模型 Provider ID（用于调试）
 */
export function getCurrentFreeModelProvider(): string | undefined {
  return lastUsedFreeModelProvider;
}

// ========================================
// 额度用尽检测和切换逻辑
// ========================================

/** 额度用尽错误关键词（中文）- 使用更精确的短语 */
const QUOTA_ERROR_PHRASES_CN = [
  "额度不足",
  "额度已用完",
  "额度用尽",
  "余额不足",
  "账户欠费",
  "免费额度已用完",
  "今日额度已耗尽",
  "配额已用尽",
  "调用次数已达上限",
  "请求次数超限",
  "每日限额",
  "超出配额",
  "免费额度",
];

/** 额度用尽错误关键词（英文）- 使用更精确的短语避免误判 */
const QUOTA_ERROR_PHRASES_EN = [
  "quota exceeded",
  "quota_exceeded",
  "insufficient quota",
  "insufficient_quota",
  "daily limit",
  "daily_limit",
  "rate limit exceeded",
  "rate_limit_exceeded",
  "out of credits",
  "usage limit exceeded",
  "billing",
  "payment required",
  "insufficient balance",
  "credit balance",
];

/**
 * 检测错误是否为额度用尽
 */
export function detectQuotaExhaustedError(
  error: unknown,
  httpStatus?: number
): boolean {
  // 从错误对象中提取消息（需要先提取，因为401需要结合消息判断）
  let errorMessage = "";
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === "string") {
    errorMessage = error;
  } else if (error && typeof error === "object") {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === "string") errorMessage = obj.message;
    else if (typeof obj.msg === "string") errorMessage = obj.msg;
    else if (typeof obj.error === "string") errorMessage = obj.error;
    else if (obj.error && typeof obj.error === "object") {
      const errObj = obj.error as Record<string, unknown>;
      if (typeof errObj.message === "string") errorMessage = errObj.message;
    }
  }

  // Try to extract HTTP status from error message if not explicitly provided.
  // Many providers return errors like "401 status code (no body)" or "403 Forbidden".
  let effectiveHttpStatus = httpStatus;
  if (!effectiveHttpStatus && errorMessage) {
    const statusMatch = errorMessage.match(/\b(40[1-3]|429)\b.*(?:status|code|forbidden|unauthorized)/i)
      || errorMessage.match(/(?:status|code|http)\s*[:=]?\s*(40[1-3]|429)/i);
    if (statusMatch) {
      effectiveHttpStatus = Number.parseInt(statusMatch[1], 10);
    }
  }

  // HTTP 状态码检测
  // 402: Payment Required（标准的付费墙状态码）
  // 429: Too Many Requests（速率限制）
  if (effectiveHttpStatus === 402 || effectiveHttpStatus === 429) {
    return true;
  }

  // 403: Forbidden - 很多中国区免费API在额度用尽时返回403
  if (effectiveHttpStatus === 403) {
    // 403 结合关键词判断，避免误判真正的权限拒绝
    if (!errorMessage) return true; // 无 body 的 403，大概率是额度问题
    const lowerMsg = errorMessage.toLowerCase();
    const quotaKeywords = [
      "quota", "balance", "limit", "credit", "额度", "余额", "用完", "耗尽",
      "no body", "exhausted", "exceeded", "expired", "insufficient",
    ];
    if (quotaKeywords.some((kw) => lowerMsg.includes(kw))) {
      return true;
    }
    // 空 body / no body 的 403
    if (lowerMsg.includes("no body") || lowerMsg.includes("empty") || errorMessage.trim().length < 10) {
      return true;
    }
  }

  if (!errorMessage) return false;

  const lowerMessage = errorMessage.toLowerCase();

  // 401: 需要特殊处理，很多免费API提供商用401表示额度用尽
  // 但为了避免误判合法的认证错误，需要结合错误消息判断
  // 如果消息中包含quota/balance/limit等关键字，才认为是额度用尽
  if (effectiveHttpStatus === 401) {
    const quotaKeywords = [
      "quota", "balance", "limit", "credit", "额度", "余额", "用完", "耗尽"
    ];
    if (quotaKeywords.some((kw) => lowerMessage.includes(kw))) {
      return true;
    }
    // 特殊情况：错误消息为空或仅包含状态码（如"401 status code (no body)"）
    // 这种情况在免费API中很常见，也视为quota exhausted
    if (lowerMessage.includes("401") && lowerMessage.includes("no body")) {
      return true;
    }
    // 空/极短消息的 401 也视为额度问题（免费 API 常见行为）
    if (errorMessage.trim().length < 10) {
      return true;
    }
  }

  // 检查中文短语（使用精确短语匹配）
  for (const phrase of QUOTA_ERROR_PHRASES_CN) {
    if (errorMessage.includes(phrase)) return true;
  }

  // 检查英文短语（使用精确短语匹配）
  for (const phrase of QUOTA_ERROR_PHRASES_EN) {
    if (lowerMessage.includes(phrase.toLowerCase())) return true;
  }

  return false;
}

/**
 * 标记当前免费模型账户为已用尽，并返回下一个可用的免费模型
 * 这是免费模型之间切换的核心函数
 * @param currentProviderId 当前使用的 provider ID（可能带有 free-model- 前缀）
 * @param sessionKey 可选的 session key
 */
export async function handleFreeModelQuotaExhausted(
  currentProviderId: string,
  sessionKey?: string
): Promise<FreeModelCheckResult> {
  const config = await loadFreeModelsConfig();

  // 提取真实的 providerId（去掉 "free-model-" 前缀）
  const realProviderId = currentProviderId.replace(/^free-model-/, "");

  // 标记当前账户为已用尽
  const account = config.accounts.find((a) => a.providerId === realProviderId);
  if (account) {
    account.status = "exhausted";
    account.lastError = "今日额度已用完";
    account.lastErrorTime = new Date().toISOString();

    // 保存配置
    try {
      const fullConfig = await loadConfig();
      (fullConfig as { freeModels?: FreeModelsConfig }).freeModels = config;
      const { writeConfigFile } = await import("../../config/config.js");
      await writeConfigFile(fullConfig);
    } catch {
      // 忽略保存错误，继续选择下一个模型
    }
  }

  // 更新缓存（清除当前 session 的记录，因为当前模型已用尽）
  setLastUsedProvider(sessionKey, undefined);
  lastUsedFreeModelProvider = undefined;

  // 选择下一个可用的免费模型
  const nextAccount = selectBestAccount(config);

  if (!nextAccount) {
    // 所有免费模型都用完了
    const previousProvider = getFreeModelProvider(realProviderId);
    return {
      useFreeModel: false,
      notification: {
        type: "exhausted",
        providerName: previousProvider?.name ?? realProviderId,
        message: "ClawdbotCN专属权益：今日免费额度已全部用完，已自动切换回付费模型",
        showInChat: true,
      },
    };
  }

  // 有下一个免费模型可用
  const nextProviderConfig = getFreeModelProvider(nextAccount.providerId);
  if (!nextProviderConfig) {
    return { useFreeModel: false };
  }

  const previousProvider = getFreeModelProvider(realProviderId);
  
  // 更新缓存
  setLastUsedProvider(sessionKey, nextAccount.providerId);
  lastUsedFreeModelProvider = nextAccount.providerId;
  
  const freeModelProviderId = `free-model-${nextAccount.providerId}`;

  return {
    useFreeModel: true,
    providerId: freeModelProviderId,
    model: nextProviderConfig.defaultModel,
    baseUrl: nextProviderConfig.baseUrl,
    apiKey: nextAccount.apiKey,
    notification: {
      type: "switched",
      providerName: nextProviderConfig.name,
      message: `ClawdbotCN专属权益：${previousProvider?.name ?? realProviderId} 额度已用完，已平滑切换至 ${nextProviderConfig.name}`,
      showInChat: true,
    },
    account: nextAccount,
    providerConfig: nextProviderConfig,
  };
}
