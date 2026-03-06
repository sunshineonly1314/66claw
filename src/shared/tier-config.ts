/**
 * Unified Tier Configuration — Single Source of Truth (SSOT)
 * 统一权限配置中心
 *
 * 所有 Tier / Feature / Page / Quota / Model 权限映射都在此文件定义。
 * Gateway 和 UI 层共同引用此文件，新增功能只改这里。
 *
 * 重要：本文件为 shared 模块，不得依赖 node:* 模块！
 */

// ============================================================================
// Tier 定义
// ============================================================================

/**
 * License Tier 类型
 * - trial: 试用版
 * - basic: 基础版
 * - standard: 中级版（新增）
 * - pro: 高级版（现有）
 * - enterprise: 企业版（新增）
 * - test: 开发测试
 */
export type LicenseTier = "trial" | "basic" | "standard" | "pro" | "enterprise" | "test";

/**
 * Tier 等级排序（用于 >= 比较）
 * 数值越大等级越高
 */
export const TIER_ORDER: Record<LicenseTier, number> = {
  trial: 0,
  basic: 1,
  standard: 2,
  pro: 3,
  enterprise: 4,
  test: 99,
};

// ============================================================================
// Feature Code 矩阵
// ============================================================================

/**
 * 各 Tier 包含的 Feature Code（累积继承，高级包含低级所有功能）
 *
 * Feature 命名规范：
 *   - 基础功能: basic_chat, basic_skills, history_7days
 *   - 中级功能: standard_skills, model_mid, history_30days
 *   - 高级功能: advanced_skills, model_sota, agent-team, orchestrator, memory-core
 *   - 企业功能: sso, audit_log, api_access, custom_model
 */
export const TIER_FEATURES: Record<LicenseTier, readonly string[]> = {
  trial: ["basic_chat", "basic_skills", "history_7days"],
  basic: ["basic_chat", "basic_skills", "history_7days"],
  standard: ["basic_chat", "basic_skills", "standard_skills", "history_30days", "model_mid"],
  pro: [
    "basic_chat",
    "basic_skills",
    "standard_skills",
    "advanced_skills",
    "history_unlimited",
    "model_mid",
    "model_sota",
    "agent-team",
    "orchestrator",
    "memory-core",
    "priority_response",
  ],
  enterprise: [
    "basic_chat",
    "basic_skills",
    "standard_skills",
    "advanced_skills",
    "history_unlimited",
    "model_mid",
    "model_sota",
    "agent-team",
    "orchestrator",
    "memory-core",
    "priority_response",
    "sso",
    "audit_log",
    "api_access",
    "custom_model",
  ],
  test: ["*"], // 全部功能
};

// ============================================================================
// 高价值功能（需要在线 Token，不允许离线降级）
// ============================================================================

/**
 * 高价值功能集合
 * 这些功能必须持有有效的 Short-Term Token，不允许离线缓存降级。
 * 服务端 tierLimit="basic" 时会强制拒绝这些功能。
 */
export const HIGH_VALUE_FEATURES = new Set<string>(["agent-team", "orchestrator", "memory-core"]);

// ============================================================================
// 页面 / Tab → Feature 映射
// ============================================================================

/**
 * 页面/Tab 对应的 feature 需求
 *
 * - null  = 所有用户可见（无需任何 feature）
 * - string = 需要该 feature code 才可见
 *
 * 新增页面时在此添加映射即可，navigation.ts 自动生效。
 */
export const PAGE_FEATURE_MAP: Record<string, string | null> = {
  // ---- 所有人可见 ----
  chat: null,
  overview: null,
  "model-config": null,
  usage: null,
  channels: null,
  network: null,
  sessions: null,
  cron: null,
  skills: null,
  config: null,
  debug: null,
  logs: null,
  docs: null,

  // ---- 以下 tab 所有人可见，具体功能入口（如"智能组队"按钮）在 UI 层用 renderFeatureGate 控制 ----
  agents: null,
  extensions: null,
  playground: null,
  nodes: null,
};

// ============================================================================
// 模型权限
// ============================================================================

/**
 * License Tier → 允许使用的模型 Tier 集合
 * 模型 tier 值: "cheap" | "mid" | "sota"（来自 orchestrator/model-gate.ts）
 */
export const MODEL_TIER_ACCESS: Record<LicenseTier, ReadonlySet<string>> = {
  trial: new Set(["cheap"]),
  basic: new Set(["cheap"]),
  standard: new Set(["cheap", "mid"]),
  pro: new Set(["cheap", "mid", "sota"]),
  enterprise: new Set(["cheap", "mid", "sota"]),
  test: new Set(["cheap", "mid", "sota"]),
};

// ============================================================================
// 并发 & 配额限制
// ============================================================================

/**
 * 最大并发 Agent 数
 */
export const CONCURRENT_LIMITS: Record<LicenseTier, number> = {
  trial: 1,
  basic: 1,
  standard: 2,
  pro: 4,
  enterprise: 8,
  test: 99,
};

/**
 * 日 Token 限额（Infinity = 无限）
 */
export const DAILY_TOKEN_LIMITS: Record<LicenseTier, number> = {
  trial: 50_000,
  basic: 50_000,
  standard: 500_000,
  pro: Infinity,
  enterprise: Infinity,
  test: Infinity,
};

/**
 * 设备绑定上限
 */
export const DEVICE_LIMITS: Record<LicenseTier, number> = {
  trial: 1,
  basic: 1,
  standard: 2,
  pro: 3,
  enterprise: 10,
  test: 99,
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 标准化 tier 值（向后兼容）
 * 目前 pro 保持不变；未来如果改名再在此添加映射。
 */
export function normalizeTier(raw: string | null | undefined): LicenseTier {
  if (!raw) return "basic";
  const lower = raw.toLowerCase().trim();
  if (lower in TIER_ORDER) return lower as LicenseTier;
  // 未知值降级为 basic
  return "basic";
}

/**
 * 检查 current tier 是否 >= required tier
 */
export function isTierAtLeast(current: LicenseTier, required: LicenseTier): boolean {
  return TIER_ORDER[current] >= TIER_ORDER[required];
}

/**
 * 获取某 tier 的全部 feature code 列表
 */
export function getFeaturesForTier(tier: LicenseTier): readonly string[] {
  return TIER_FEATURES[tier] ?? TIER_FEATURES.basic;
}

/**
 * 检查某 feature 是否属于某 tier
 */
export function tierHasFeature(tier: LicenseTier, feature: string): boolean {
  const features = TIER_FEATURES[tier];
  if (!features) return false;
  if (features.includes("*")) return true;
  return features.includes(feature);
}

/**
 * 检查一个 feature 列表是否包含某 tab 所需的 feature
 * 用于 UI 层 tab 过滤
 */
export function isPageAllowed(tab: string, features: readonly string[]): boolean {
  const required = PAGE_FEATURE_MAP[tab];
  if (required === null || required === undefined) return true; // 无需 feature
  if (features.includes("*")) return true;
  return features.includes(required);
}
