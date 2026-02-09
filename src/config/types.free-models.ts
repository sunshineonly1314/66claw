/**
 * ClawdbotCN 独家福利：每日免费大模型平滑切换工具
 * 类型定义
 */

import { getBeijingDateString } from "./free-models-time.js";

/**
 * 免费模型 Provider 定义（内置配置）
 */
export interface FreeModelProvider {
  /** Provider ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 显示名称（带模型） */
  displayName: string;
  /** API Base URL */
  baseUrl: string;
  /** 支持的模型列表 */
  models: string[];
  /** 默认模型 */
  defaultModel: string;
  /** 免费额度配置 */
  freeQuota: {
    /** 额度类型 */
    type: "daily" | "permanent";
    /** 额度限制（tokens 或 requests） */
    limit: number;
    /** 单位 */
    unit: "tokens" | "requests";
    /** 重置时间（cron 格式或描述） */
    resetsAt?: string;
  };
  /** 环境变量名 */
  envKey: string;
  /** 注册链接 */
  registerUrl: string;
  /** API 文档链接 */
  docsUrl: string;
  /** 特性描述 */
  features: string[];
  /** 是否推荐 */
  recommended: boolean;
  /** 错误码配置 - 用于识别额度不足 */
  errorCodes: {
    /** 数字错误码 */
    numericCodes?: number[];
    /** 字符串错误码 */
    stringCodes?: string[];
    /** 错误码字段路径 */
    codeField?: string;
    /** HTTP 状态码 */
    httpStatus?: number[];
  };
}

/**
 * 用户配置的免费模型账号
 */
export interface FreeModelAccount {
  /** Provider ID */
  providerId: string;
  /** API 密钥 */
  apiKey: string;
  /** 是否启用 */
  enabled: boolean;
  /** 优先级（数字越小优先级越高） */
  priority: number;
  /** 今日使用统计 */
  todayUsage: {
    /** 已使用 tokens */
    tokens: number;
    /** 请求次数 */
    requests: number;
    /** 最后更新时间 */
    lastUpdated: string;
  };
  /** 状态 */
  status: "active" | "exhausted" | "error" | "disabled";
  /** 最后错误信息 */
  lastError?: string;
  /** 最后错误时间 */
  lastErrorTime?: string;
  /** 速率限制冷却截止时间（ISO 字符串），在此之前不应使用该账号 */
  rateLimitedUntil?: string;
}

/**
 * 免费模型用户配置
 */
export interface FreeModelsConfig {
  /** 是否启用每日免费模型功能 */
  enabled: boolean;
  /** 用户配置的账号列表 */
  accounts: FreeModelAccount[];
  /** 调度设置 */
  scheduling: {
    /** 切换策略 */
    strategy: "priority" | "round_robin";
    /** 是否显示切换提示 */
    showNotification: boolean;
    /** 预检模式（发送前检查额度） */
    preCheck: boolean;
  };
  /** 统计数据 */
  stats: {
    /** 今日节省金额（元） */
    todaySavings: number;
    /** 累计节省金额（元） */
    totalSavings: number;
    /** 今日免费调用次数 */
    todayFreeRequests: number;
    /** 最后重置日期 */
    lastResetDate: string;
  };
  /** 切换历史 */
  switchHistory: FreeModelSwitchRecord[];
}

/**
 * 切换记录
 */
export interface FreeModelSwitchRecord {
  /** 时间戳 */
  timestamp: string;
  /** 原模型 */
  fromProvider: string;
  /** 新模型 */
  toProvider: string;
  /** 切换原因 */
  reason: "quota_exhausted" | "error" | "manual";
  /** 节省金额 */
  savings: number;
}

/**
 * 切换通知
 */
export interface FreeModelSwitchNotification {
  /** 通知类型 */
  type: "switch" | "all_exhausted" | "error";
  /** 原 Provider */
  fromProvider?: string;
  /** 新 Provider */
  toProvider?: string;
  /** 原因 */
  reason: string;
  /** 显示消息 */
  message: string;
  /** 节省金额 */
  savings?: number;
  /** 今日累计节省 */
  todaySavings?: number;
}

/**
 * 额度检查结果
 */
export interface QuotaCheckResult {
  /** 是否是额度不足错误 */
  isQuotaError: boolean;
  /** Provider ID */
  provider: string;
  /** 原因 */
  reason: "daily_limit" | "balance" | "rate_limit" | "unknown";
  /** 置信度 */
  confidence: "high" | "medium" | "low";
  /** 原始错误 */
  originalError?: unknown;
}

/**
 * 默认配置
 */
export const DEFAULT_FREE_MODELS_CONFIG: FreeModelsConfig = {
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
    lastResetDate: getBeijingDateString(),
  },
  switchHistory: [],
};
