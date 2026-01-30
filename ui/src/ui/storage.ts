const KEY = "clawdbot.control.settings.v1";
const DOCS_KEY = "clawdbot.docs.v1";

import type { ThemeMode } from "./theme";

export type UiSettings = {
  gatewayUrl: string;
  token: string;
  sessionKey: string;
  lastActiveSessionKey: string;
  theme: ThemeMode;
  chatFocusMode: boolean;
  chatShowThinking: boolean;
  splitRatio: number; // Sidebar split ratio (0.4 to 0.7, default 0.6)
  navCollapsed: boolean; // Collapsible sidebar state
  navGroupsCollapsed: Record<string, boolean>; // Which nav groups are collapsed
};

/**
 * 文档中心存储
 */
export type DocsStorage = {
  favorites: string[]; // 收藏的文档 ID
  history: { id: string; timestamp: number }[]; // 浏览历史
  lastSearchQuery: string; // 上次搜索词
};

export function loadSettings(): UiSettings {
  const defaultUrl = (() => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${location.host}`;
  })();

  const defaults: UiSettings = {
    gatewayUrl: defaultUrl,
    token: "",
    sessionKey: "main",
    lastActiveSessionKey: "main",
    theme: "system",
    chatFocusMode: false,
    chatShowThinking: true,
    splitRatio: 0.6,
    navCollapsed: false,
    navGroupsCollapsed: {},
  };

  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<UiSettings>;
    return {
      gatewayUrl:
        typeof parsed.gatewayUrl === "string" && parsed.gatewayUrl.trim()
          ? parsed.gatewayUrl.trim()
          : defaults.gatewayUrl,
      token: typeof parsed.token === "string" ? parsed.token : defaults.token,
      sessionKey:
        typeof parsed.sessionKey === "string" && parsed.sessionKey.trim()
          ? parsed.sessionKey.trim()
          : defaults.sessionKey,
      lastActiveSessionKey:
        typeof parsed.lastActiveSessionKey === "string" &&
        parsed.lastActiveSessionKey.trim()
          ? parsed.lastActiveSessionKey.trim()
          : (typeof parsed.sessionKey === "string" &&
              parsed.sessionKey.trim()) ||
            defaults.lastActiveSessionKey,
      theme:
        parsed.theme === "light" ||
        parsed.theme === "dark" ||
        parsed.theme === "system"
          ? parsed.theme
          : defaults.theme,
      chatFocusMode:
        typeof parsed.chatFocusMode === "boolean"
          ? parsed.chatFocusMode
          : defaults.chatFocusMode,
      chatShowThinking:
        typeof parsed.chatShowThinking === "boolean"
          ? parsed.chatShowThinking
          : defaults.chatShowThinking,
      splitRatio:
        typeof parsed.splitRatio === "number" &&
        parsed.splitRatio >= 0.4 &&
        parsed.splitRatio <= 0.7
          ? parsed.splitRatio
          : defaults.splitRatio,
      navCollapsed:
        typeof parsed.navCollapsed === "boolean"
          ? parsed.navCollapsed
          : defaults.navCollapsed,
      navGroupsCollapsed:
        typeof parsed.navGroupsCollapsed === "object" &&
        parsed.navGroupsCollapsed !== null
          ? parsed.navGroupsCollapsed
          : defaults.navGroupsCollapsed,
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(next: UiSettings) {
  localStorage.setItem(KEY, JSON.stringify(next));
}

// ============================================================================
// 文档中心存储
// ============================================================================

const MAX_HISTORY_LENGTH = 20;

function getDefaultDocsStorage(): DocsStorage {
  return {
    favorites: [],
    history: [],
    lastSearchQuery: "",
  };
}

export function loadDocsStorage(): DocsStorage {
  try {
    const raw = localStorage.getItem(DOCS_KEY);
    if (!raw) return getDefaultDocsStorage();
    const parsed = JSON.parse(raw) as Partial<DocsStorage>;
    return {
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      lastSearchQuery:
        typeof parsed.lastSearchQuery === "string" ? parsed.lastSearchQuery : "",
    };
  } catch {
    return getDefaultDocsStorage();
  }
}

export function saveDocsStorage(next: DocsStorage) {
  localStorage.setItem(DOCS_KEY, JSON.stringify(next));
}

/**
 * 添加到收藏
 */
export function addDocFavorite(docId: string) {
  const storage = loadDocsStorage();
  if (!storage.favorites.includes(docId)) {
    storage.favorites.unshift(docId);
    saveDocsStorage(storage);
  }
}

/**
 * 从收藏移除
 */
export function removeDocFavorite(docId: string) {
  const storage = loadDocsStorage();
  storage.favorites = storage.favorites.filter((id) => id !== docId);
  saveDocsStorage(storage);
}

/**
 * 检查是否已收藏
 */
export function isDocFavorite(docId: string): boolean {
  const storage = loadDocsStorage();
  return storage.favorites.includes(docId);
}

/**
 * 添加到浏览历史
 */
export function addDocHistory(docId: string) {
  const storage = loadDocsStorage();
  // 移除已存在的相同记录
  storage.history = storage.history.filter((item) => item.id !== docId);
  // 添加到最前面
  storage.history.unshift({ id: docId, timestamp: Date.now() });
  // 限制历史记录数量
  if (storage.history.length > MAX_HISTORY_LENGTH) {
    storage.history = storage.history.slice(0, MAX_HISTORY_LENGTH);
  }
  saveDocsStorage(storage);
}

/**
 * 获取浏览历史
 */
export function getDocHistory(): { id: string; timestamp: number }[] {
  const storage = loadDocsStorage();
  return storage.history;
}

/**
 * 保存搜索词
 */
export function saveLastSearchQuery(query: string) {
  const storage = loadDocsStorage();
  storage.lastSearchQuery = query;
  saveDocsStorage(storage);
}

/**
 * 获取上次搜索词
 */
export function getLastSearchQuery(): string {
  const storage = loadDocsStorage();
  return storage.lastSearchQuery;
}
