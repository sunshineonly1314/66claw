/**
 * Clawdbot CLI 国际化模块
 * Internationalization Module for Clawdbot CLI
 *
 * 简单的 i18n 实现，支持：
 * - 多语言切换
 * - 模板变量替换
 * - 环境变量语言检测
 */

import { en, type TranslationDict, type TranslationKeys } from "./locales/en.js";
import { zhCN } from "./locales/zh-CN.js";

// ============================================================================
// 类型定义 (Type Definitions)
// ============================================================================

/** 支持的语言 */
export type Locale = "en" | "zh-CN";

/** 翻译键类型 */
export type TranslationKey = TranslationKeys;

// 重新导出翻译字典类型
export type { TranslationDict, TranslationKeys };

// ============================================================================
// 配置 (Configuration)
// ============================================================================

/** 默认语言 - 写死中文 */
const DEFAULT_LOCALE: Locale = "zh-CN";

/** 所有语言包 */
const LOCALES: Record<Locale, TranslationDict> = {
  en,
  "zh-CN": zhCN,
};

/** 语言显示名称 */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  "zh-CN": "简体中文",
};

// ============================================================================
// 状态 (State)
// ============================================================================

/** 当前语言 */
let currentLocale: Locale = DEFAULT_LOCALE;

/** 是否已初始化 */
let initialized = false;

// ============================================================================
// 核心函数 (Core Functions)
// ============================================================================

/**
 * 检测系统语言
 * 写死中文 - 全部用户都是中文用户
 */
function detectSystemLocale(): Locale {
  return "zh-CN";
}

/**
 * 初始化 i18n
 * 自动检测系统语言
 */
export function initI18n(locale?: Locale): Locale {
  if (locale) {
    currentLocale = locale;
  } else {
    currentLocale = detectSystemLocale();
  }
  initialized = true;
  return currentLocale;
}

/**
 * 确保 i18n 已初始化
 */
function ensureInitialized(): void {
  if (!initialized) {
    initI18n();
  }
}

/**
 * 获取当前语言
 */
export function getLocale(): Locale {
  ensureInitialized();
  return currentLocale;
}

/**
 * 设置语言
 */
export function setLocale(locale: Locale): void {
  currentLocale = locale;
  initialized = true;
}

/**
 * 获取翻译文本
 * @param key 翻译键
 * @param params 模板参数 (可选)
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  ensureInitialized();
  const dict = LOCALES[currentLocale] ?? LOCALES[DEFAULT_LOCALE];
  let text = dict[key] ?? en[key] ?? key;

  // 模板变量替换: {{variable}}
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{\\{${paramKey}\\}\\}`, "g"), String(paramValue));
    }
  }

  return text;
}

/**
 * 获取所有支持的语言列表
 */
export function getAvailableLocales(): Locale[] {
  return Object.keys(LOCALES) as Locale[];
}

/**
 * 判断是否为中文环境
 */
export function isChineseLocale(): boolean {
  ensureInitialized();
  return currentLocale === "zh-CN";
}

/**
 * 判断是否为英文环境
 */
export function isEnglishLocale(): boolean {
  ensureInitialized();
  return currentLocale === "en";
}
