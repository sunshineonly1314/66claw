import type { IconName } from "./icons.js";
import { t } from "./i18n/index.js";
import { isPageAllowed } from "../../../src/shared/tier-config.js";

/**
 * 导航标签组（使用翻译函数）
 * 调用 getTabGroups() 获取翻译后的标签组
 */
export const TAB_GROUPS = [
  { label: "Chat", tabs: ["chat"] },
  {
    label: "Control",
    tabs: ["overview", "model-config", "usage", "channels", "network", "sessions", "cron"],
  },
  { label: "Agent", tabs: ["agents", "skills", "extensions"] },
  { label: "Settings", tabs: ["config", "debug", "logs"] },
] as const;

/**
 * 获取翻译后的标签组
 *
 * @param features - 当前用户的 feature code 列表（可选）。
 *   传入时按 PAGE_FEATURE_MAP 过滤不可见 tab；
 *   不传时返回全部 tab（向后兼容）。
 */
export function getTabGroups(features?: readonly string[]) {
  const all = [
    { label: t("nav.chat"), tabs: ["chat"] as const },
    {
      label: t("nav.control"),
      tabs: ["overview", "model-config", "usage", "channels", "network", "sessions", "cron"] as const,
    },
    { label: t("nav.agent"), tabs: ["agents", "skills", "extensions"] as const },
    { label: t("nav.settings"), tabs: ["config", "debug", "logs"] as const },
  ];

  if (!features) return all;

  return all
    .map((group) => ({
      ...group,
      tabs: group.tabs.filter((tab) => isPageAllowed(tab, features)),
    }))
    .filter((group) => group.tabs.length > 0);
}

export type Tab =
  | "overview"
  | "model-config"
  | "usage"
  | "channels"
  | "instances"
  | "sessions"
  | "cron"
  | "agents"
  | "playground"
  | "skills"
  | "extensions"
  | "nodes"
  | "network"
  | "chat"
  | "config"
  | "debug"
  | "logs"
  | "docs";

const TAB_PATHS: Record<Tab, string> = {
  overview: "/overview",
  "model-config": "/model-config",
  usage: "/usage",
  channels: "/channels",
  instances: "/instances",
  sessions: "/sessions",
  cron: "/cron",
  agents: "/agents",
  playground: "/playground",
  skills: "/skills",
  extensions: "/extensions",
  nodes: "/nodes",
  network: "/network",
  chat: "/chat",
  config: "/config",
  debug: "/debug",
  logs: "/logs",
  docs: "/docs",
};

const PATH_TO_TAB = new Map(
  Object.entries(TAB_PATHS).map(([tab, path]) => [path, tab as Tab]),
);

export function normalizeBasePath(basePath: string): string {
  if (!basePath) return "";
  let base = basePath.trim();
  if (!base.startsWith("/")) base = `/${base}`;
  if (base === "/") return "";
  if (base.endsWith("/")) base = base.slice(0, -1);
  return base;
}

export function normalizePath(path: string): string {
  if (!path) return "/";
  let normalized = path.trim();
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function pathForTab(tab: Tab, basePath = ""): string {
  const base = normalizeBasePath(basePath);
  const path = TAB_PATHS[tab];
  return base ? `${base}${path}` : path;
}

export function tabFromPath(pathname: string, basePath = ""): Tab | null {
  const base = normalizeBasePath(basePath);
  let path = pathname || "/";
  if (base) {
    if (path === base) {
      path = "/";
    } else if (path.startsWith(`${base}/`)) {
      path = path.slice(base.length);
    }
  }
  let normalized = normalizePath(path).toLowerCase();
  if (normalized.endsWith("/index.html")) normalized = "/";
  if (normalized === "/") return "chat";
  return PATH_TO_TAB.get(normalized) ?? null;
}

export function inferBasePathFromPathname(pathname: string): string {
  let normalized = normalizePath(pathname);
  if (normalized.endsWith("/index.html")) {
    normalized = normalizePath(normalized.slice(0, -"/index.html".length));
  }
  if (normalized === "/") return "";
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) return "";
  for (let i = 0; i < segments.length; i++) {
    const candidate = `/${segments.slice(i).join("/")}`.toLowerCase();
    if (PATH_TO_TAB.has(candidate)) {
      const prefix = segments.slice(0, i);
      return prefix.length ? `/${prefix.join("/")}` : "";
    }
  }
  return `/${segments.join("/")}`;
}

export function iconForTab(tab: Tab): IconName {
  switch (tab) {
    case "chat":
      return "messageSquare";
    case "overview":
      return "barChart";
    case "model-config":
      return "cpu";
    case "usage":
      return "activity";
    case "channels":
      return "link";
    case "instances":
      return "radio";
    case "sessions":
      return "fileText";
    case "cron":
      return "loader";
    case "agents":
      return "folder";
    case "playground":
      return "play";
    case "skills":
      return "zap";
    case "extensions":
      return "plug";
    case "nodes":
      return "monitor";
    case "network":
      return "network";
    case "config":
      return "settings";
    case "debug":
      return "bug";
    case "logs":
      return "scrollText";
    case "docs":
      return "book";
    default:
      return "folder";
  }
}

export function titleForTab(tab: Tab) {
  switch (tab) {
    case "overview":
      return t("nav.overview");
    case "model-config":
      return t("nav.modelConfig");
    case "usage":
      return t("nav.usage");
    case "channels":
      return t("nav.channels");
    case "instances":
      return t("nav.instances");
    case "sessions":
      return t("nav.sessions");
    case "cron":
      return t("nav.cron");
    case "agents":
      return t("nav.agents");
    case "playground":
      return t("nav.playground");
    case "skills":
      return t("nav.skills");
    case "extensions":
      return t("nav.extensions");
    case "nodes":
      return t("nav.nodes");
    case "network":
      return t("nav.network");
    case "chat":
      return t("nav.chat");
    case "config":
      return t("nav.config");
    case "debug":
      return t("nav.debug");
    case "logs":
      return t("nav.logs");
    case "docs":
      return t("nav.docs");
    default:
      return t("nav.control");
  }
}

export function subtitleForTab(tab: Tab) {
  switch (tab) {
    case "overview":
      return t("subtitle.overview");
    case "model-config":
      return t("subtitle.modelConfig");
    case "usage":
      return t("subtitle.usage");
    case "channels":
      return t("subtitle.channels");
    case "instances":
      return t("subtitle.instances");
    case "sessions":
      return t("subtitle.sessions");
    case "cron":
      return t("subtitle.cron");
    case "agents":
      return t("subtitle.agents");
    case "playground":
      return t("subtitle.playground");
    case "skills":
      return t("subtitle.skills");
    case "extensions":
      return t("subtitle.extensions");
    case "nodes":
      return t("subtitle.nodes");
    case "network":
      return t("subtitle.network");
    case "chat":
      return t("subtitle.chat");
    case "config":
      return t("subtitle.config");
    case "debug":
      return t("subtitle.debug");
    case "logs":
      return t("subtitle.logs");
    case "docs":
      return t("subtitle.docs");
    default:
      return "";
  }
}
