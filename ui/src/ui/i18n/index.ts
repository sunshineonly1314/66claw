/**
 * Clawdbot UI 国际化模块
 * Internationalization Module for Clawdbot UI
 *
 * 简单的 i18n 实现，支持：
 * - 多语言切换
 * - 模板变量替换
 * - 浏览器语言自动检测
 * - LocalStorage 持久化
 */

import { en } from "./locales/en.js";
import { zhCN } from "./locales/zh-CN.js";

// ============================================================================
// 类型定义 (Type Definitions)
// ============================================================================

/** 支持的语言 */
export type Locale = "en" | "zh-CN";

/** 翻译字典类型 */
export type TranslationDict = typeof en;

/** 翻译键类型 */
export type TranslationKey = keyof TranslationDict;

// ============================================================================
// 配置 (Configuration)
// ============================================================================

/** 默认语言 */
const DEFAULT_LOCALE: Locale = "en";

/** 语言存储键名 */
const STORAGE_KEY = "clawdbot-ui-locale";

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

/** 语言变更监听器 */
const listeners: Set<(locale: Locale) => void> = new Set();

// ============================================================================
// 核心函数 (Core Functions)
// ============================================================================

/**
 * 检测浏览器语言
 */
function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;

  const browserLang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || "";
  const lang = browserLang.toLowerCase();

  if (lang.startsWith("zh")) {
    return "zh-CN";
  }

  return DEFAULT_LOCALE;
}

/**
 * 从存储加载语言设置
 */
function loadLocaleFromStorage(): Locale | null {
  if (typeof localStorage === "undefined") return null;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (saved === "en" || saved === "zh-CN")) {
      return saved as Locale;
    }
  } catch {
    // localStorage 不可用
  }

  return null;
}

/**
 * 保存语言设置到存储
 */
function saveLocaleToStorage(locale: Locale): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // localStorage 不可用
  }
}

/**
 * 初始化 i18n
 * 按优先级：存储 > 浏览器检测 > 默认
 */
export function initI18n(): Locale {
  const storedLocale = loadLocaleFromStorage();
  const detectedLocale = detectBrowserLocale();

  currentLocale = storedLocale ?? detectedLocale;

  return currentLocale;
}

/**
 * 获取当前语言
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * 设置语言
 */
export function setLocale(locale: Locale): void {
  if (currentLocale === locale) return;

  currentLocale = locale;
  saveLocaleToStorage(locale);

  // 通知所有监听器
  listeners.forEach((listener) => listener(locale));
}

/**
 * 添加语言变更监听器
 */
export function onLocaleChange(listener: (locale: Locale) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * 获取翻译文本
 * @param key 翻译键
 * @param params 模板参数 (可选)
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
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
  return currentLocale === "zh-CN";
}

// ============================================================================
// 自动初始化 (Auto Initialize)
// ============================================================================

// 模块加载时自动初始化
initI18n();
