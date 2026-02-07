/**
 * ClawdbotCN 独家福利：每日免费大模型平滑切换工具
 * 内置免费模型 Provider 配置
 */

import type { FreeModelProvider } from "./types.free-models.js";

// 重新导出类型，方便其他模块使用
export type { FreeModelProvider };

/**
 * 支持的免费模型 Provider 列表
 * 仅包含每日免费额度的平台
 */
export const FREE_MODEL_PROVIDERS: Record<string, FreeModelProvider> = {
  /**
   * 蚂蚁百灵 - 每日 50 万 tokens
   */
  "ant-ling": {
    id: "ant-ling",
    name: "蚂蚁百灵",
    displayName: "蚂蚁百灵 Ling-1T",
    baseUrl: "https://api.tbox.cn/api/llm/v1",
    models: ["ling-1t", "ring-1t", "ming-flash-omni"],
    defaultModel: "ling-1t",
    freeQuota: {
      type: "daily",
      limit: 500000,
      unit: "tokens",
      resetsAt: "每日 00:00 (北京时间)",
    },
    envKey: "ANT_LING_API_KEY",
    registerUrl: "https://ling.tbox.cn/open",
    docsUrl: "https://alipaytbox.yuque.com/sxs0ba/ling/intro",
    features: ["多模态", "联网搜索", "复杂推理", "每日50万tokens"],
    recommended: true,
    errorCodes: {
      // 蚂蚁百灵特定错误码
      numericCodes: [41, 121],
      stringCodes: ["quota_exceeded", "daily_limit_exceeded"],
      codeField: "code",
      httpStatus: [402, 429, 403],
    },
  },

  /**
   * 美团 LongCat - 每日 50 万 tokens
   */
  "meituan-longcat": {
    id: "meituan-longcat",
    name: "美团LongCat",
    displayName: "LongCat Flash",
    baseUrl: "https://api.longcat.chat/openai/v1",
    models: ["longcat-flash-chat"],
    defaultModel: "longcat-flash-chat",
    freeQuota: {
      type: "daily",
      limit: 500000,
      unit: "tokens",
      resetsAt: "每日 00:00 (北京时间)",
    },
    envKey: "LONGCAT_API_KEY",
    registerUrl:
      "https://longcat.chat/login?countrycode=86&countryname=China&callback=https%3A%2F%2Flongcat.chat%2Fplatform",
    docsUrl: "https://longcat.chat/platform/docs/zh/",
    features: ["128K上下文", "OpenAI兼容", "Anthropic兼容", "每日50万tokens"],
    recommended: true,
    errorCodes: {
      // 美团 LongCat 使用 OpenAI 格式
      stringCodes: [
        "quota_exceeded",
        "daily_limit_exceeded",
        "insufficient_quota",
        "rate_limit_exceeded",
      ],
      codeField: "error.code",
      httpStatus: [402, 429],
    },
  },
};

/**
 * 获取所有免费模型 Provider 列表
 */
export function getAllFreeModelProviders(): FreeModelProvider[] {
  return Object.values(FREE_MODEL_PROVIDERS);
}

/**
 * 获取推荐的免费模型 Provider 列表
 */
export function getRecommendedFreeModelProviders(): FreeModelProvider[] {
  return Object.values(FREE_MODEL_PROVIDERS).filter((p) => p.recommended);
}

/**
 * 根据 ID 获取 Provider
 */
export function getFreeModelProvider(
  id: string
): FreeModelProvider | undefined {
  return FREE_MODEL_PROVIDERS[id];
}

/**
 * 计算每日总免费额度
 */
export function getTotalDailyFreeQuota(): number {
  return Object.values(FREE_MODEL_PROVIDERS)
    .filter((p) => p.freeQuota.type === "daily")
    .reduce((sum, p) => sum + p.freeQuota.limit, 0);
}

/**
 * 中文错误关键词列表 - 用于识别额度不足
 */
export const QUOTA_ERROR_KEYWORDS_CHINESE = [
  "额度不足",
  "额度已用完",
  "余额不足",
  "账户欠费",
  "免费额度已用完",
  "今日额度已耗尽",
  "配额已用尽",
  "调用次数已达上限",
  "授权限额已满",
  "请求次数超限",
  "每日限额",
  "超出配额",
];

/**
 * 英文错误关键词列表 - 用于识别额度不足
 */
export const QUOTA_ERROR_KEYWORDS_ENGLISH = [
  "quota exceeded",
  "quota_exceeded",
  "insufficient quota",
  "insufficient_quota",
  "daily limit",
  "daily_limit",
  "rate limit exceeded",
  "rate_limit_exceeded",
  "billing",
  "payment required",
  "credit balance",
  "out of credits",
  "usage limit",
];

/**
 * 估算每 token 的价格（用于计算节省金额）
 * 单位：元/千tokens
 */
export const ESTIMATED_PRICE_PER_1K_TOKENS = 0.002; // 约 ¥0.002/千tokens
