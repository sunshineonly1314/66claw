/**
 * SkillWash 清洗工程配置
 * 使用阿里云百炼 Coding Plan API (OpenAI 兼容协议)
 */

export const QWEN_CONFIG = {
  apiKey: process.env.SKILLWASH_API_KEY ?? "sk-sp-07ac2eb2bef54a26892d9feeadf7d004",
  baseUrl: "https://coding.dashscope.aliyuncs.com/v1",
  model: "qwen3-max-2026-01-23",
  temperature: 0.1,
  maxTokens: 4096,
  timeoutMs: 120_000,
  maxRetries: 2,
  /** 并发请求数 */
  concurrency: 3,
  /** 每分钟最大请求 (Coding Plan 限速) */
  maxRpm: 15,
};

/** Layer 1 规则引擎阈值 */
export const LAYER1_THRESHOLDS = {
  maxFileSize: 50_000,
  maxBodyLines: 2000,
  maxDescriptionLength: 1000,
  /** 匹配到任何 critical → reject */
  criticalAutoReject: true,
  /** 匹配到 N 个以上 danger → reject */
  dangerRejectThreshold: 2,
};

/** Layer 2 安全审计阈值 */
export const LAYER2_THRESHOLDS = {
  /** confidence 低于此值 → 标记 review */
  minConfidence: 0.7,
  /** Layer 1 标记 review 的技能，需要 Qwen confidence 高于此值才能 pass */
  layer1ReviewOverrideConfidence: 0.9,
};

/** Layer 3 质量评估阈值 */
export const LAYER3_THRESHOLDS = {
  /** 最低收录分数 (B 级) */
  minOverallScore: 5.0,
  /** S 级门槛 */
  sTierThreshold: 9.0,
  /** A 级门槛 */
  aTierThreshold: 7.0,
};

/** 输出目录 */
export const OUTPUT_DIR = "./skillsqingxi/output";
