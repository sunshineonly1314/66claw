import { html, nothing } from "lit";

import { clampText } from "../format";
import { t, tMaybe } from "../i18n/index.js";
import { icons } from "../icons.js";
import type { SkillStatusEntry, SkillStatusReport, SkillsMarketResponse } from "../types";
import type { SkillMessageMap, SkillsTab, InstallProgress } from "../controllers/skills";

// ============================================================================
// 三状态 Tab 定义
// ============================================================================
export type SkillTabId = "core" | "ready" | "blocked";

// ============================================================================
// 平台兼容性检测（缓存结果避免重复计算）
// ============================================================================
const _platformCache = new Map<string, { compatible: boolean; requiredPlatform?: string }>();
let _currentPlatform: "win32" | "darwin" | "linux" | null = null;

function getCurrentPlatform(): "win32" | "darwin" | "linux" {
  if (_currentPlatform) return _currentPlatform;
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) _currentPlatform = "win32";
  else if (ua.includes("mac")) _currentPlatform = "darwin";
  else _currentPlatform = "linux";
  return _currentPlatform;
}

const MACOS_ONLY_KEYWORDS = [
  "apple", "macos", "mac-os", "osx", "swiftui", "swift-ui",
  "bear-notes", "bear-note", "reminders", "apple-mail", "apple-notes",
  "apple-music", "apple-calendar", "apple-contacts", "apple-photos",
  "finder", "spotlight", "shortcuts", "raycast", "alfred",
  "homebrew", "brew-", "-brew", "xcode", "xcrun", "osascript",
  "coreml", "core-ml", "appkit", "uikit", "cocoa",
  "imessage", "facetime", "airdrop", "keychain", "launchd",
];

const WINDOWS_ONLY_KEYWORDS = [
  "windows", "win32", "win64", "powershell", "cmd-", "-cmd",
  "registry", "wsl", "winget", "msedge", "outlook-win",
  "notepad", "explorer-", "taskbar", "cortana",
];

const LINUX_ONLY_KEYWORDS = [
  "linux", "ubuntu", "debian", "fedora", "centos", "arch-linux",
  "systemd", "apt-get", "yum", "dnf", "pacman",
  "gnome", "kde", "xorg", "wayland",
];

const HIDDEN_SKILLS_CN = ["clawdhub"];

// ============================================================================
// 技能分类定义（关键字匹配）
// ============================================================================
const SKILL_CATEGORIES: Array<{ id: string; emoji: string; keywords: string[] }> = [
  { id: "all",           emoji: "\u{1F31F}", keywords: [] },
  { id: "lifestyle",     emoji: "\u{1F3E1}", keywords: [
    "weather", "food", "delivery", "maps", "music", "smart-home", "home-assistant",
    "recipe", "cooking", "health", "fitness", "travel", "transport",
    "spotify", "playlist", "workout", "meditation", "sleep", "nutrition",
  ]},
  { id: "finance",       emoji: "\u{1F4B0}", keywords: [
    "stock", "fund", "budget", "invest", "finance", "bank", "payment", "crypto",
    "bitcoin", "ethereum", "trading", "portfolio", "tax", "accounting", "ledger",
    "a-stock", "coinbase", "stripe", "paypal",
  ]},
  { id: "computer",      emoji: "\u{1F4BB}", keywords: [
    "screenshot", "screen-capture", "filesystem", "file-manager", "terminal", "shell",
    "desktop", "keyboard", "mouse", "clipboard", "browser", "process-manager",
    "disk", "cpu", "monitor", "display", "finder", "explorer",
  ]},
  { id: "productivity",  emoji: "\u26A1",    keywords: [
    "notes", "reminder", "calendar", "todo", "email", "planner",
    "schedule", "agenda", "notion", "obsidian", "evernote", "trello",
    "asana", "jira", "linear", "spreadsheet", "excel",
  ]},
  { id: "creative",      emoji: "\u{1F3A8}", keywords: [
    "image", "video", "draw", "drawing", "paint", "photo", "camera",
    "animation", "3d", "midjourney", "dalle", "stable-diffusion",
    "canvas", "illustration", "graphic", "artwork",
  ]},
  { id: "communication", emoji: "\u{1F4AC}", keywords: [
    "message", "social", "chat", "voice-call", "sms", "whatsapp", "telegram",
    "slack", "discord", "wechat", "weixin", "twitter", "facebook", "linkedin",
    "instagram", "tiktok", "imessage", "facetime", "zoom", "teams",
  ]},
  { id: "development",   emoji: "\u{1F6E0}\uFE0F", keywords: [
    "github", "gitlab", "code", "debug", "docker", "kubernetes", "npm",
    "pip", "rust", "python", "javascript", "typescript", "sql", "database",
    "postgres", "mysql", "redis", "aws", "azure", "gcp", "deploy", "ci-cd",
    "lint", "compiler", "vscode", "gemini",
  ]},
];

// 技能分类缓存
const _categoryCache = new Map<string, string>();

/** 将关键字列表编译为单个正则（匹配单词边界），缓存在闭包中 */
const _categoryRegexMap = new Map<string, RegExp>();
function _getCategoryRegex(cat: typeof SKILL_CATEGORIES[number]): RegExp {
  let re = _categoryRegexMap.get(cat.id);
  if (!re) {
    // 对每个关键字用 \b 包裹，合并为一个 OR 正则
    const escaped = cat.keywords.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    re = new RegExp(`\\b(?:${escaped.join("|")})\\b`);
    _categoryRegexMap.set(cat.id, re);
  }
  return re;
}

function getSkillCategory(skill: SkillStatusEntry): string {
  const cached = _categoryCache.get(skill.skillKey);
  if (cached) return cached;

  // 主要匹配 skill name（连字符转空格以支持 \b 边界）
  const nameText = skill.name.toLowerCase().replace(/-/g, " ");
  // 描述文本作为辅助（使用本地化翻译函数获取中文）
  const descText = [
    skill.description,
    getLocalizedSkillName(skill.name),
    getLocalizedSkillDesc(skill.name, skill.description),
  ].join(" ").toLowerCase();
  const searchText = nameText + " " + descText;

  for (const cat of SKILL_CATEGORIES) {
    if (cat.id === "all") continue;
    if (_getCategoryRegex(cat).test(searchText)) {
      _categoryCache.set(skill.skillKey, cat.id);
      return cat.id;
    }
  }

  _categoryCache.set(skill.skillKey, "other");
  return "other";
}

function isSkillHidden(skillName: string): boolean {
  return HIDDEN_SKILLS_CN.includes(skillName.toLowerCase());
}

function checkPlatformCompatibility(skillName: string): { compatible: boolean; requiredPlatform?: string } {
  const cached = _platformCache.get(skillName);
  if (cached) return cached;

  const platform = getCurrentPlatform();
  const name = skillName.toLowerCase();
  let result: { compatible: boolean; requiredPlatform?: string } = { compatible: true };

  if (MACOS_ONLY_KEYWORDS.some(kw => name.includes(kw)) && platform !== "darwin") {
    result = { compatible: false, requiredPlatform: "macOS" };
  } else if (WINDOWS_ONLY_KEYWORDS.some(kw => name.includes(kw)) && platform !== "win32") {
    result = { compatible: false, requiredPlatform: "Windows" };
  } else if (LINUX_ONLY_KEYWORDS.some(kw => name.includes(kw)) && platform !== "linux") {
    result = { compatible: false, requiredPlatform: "Linux" };
  }

  _platformCache.set(skillName, result);
  return result;
}

// ============================================================================
// 技能名称本地化
// ============================================================================
const _skillsUpperWords = new Set([
  'api', 'cli', 'ui', 'ai', 'id', 'url', 'http', 'https', 'ssh', 'ftp',
  'sql', 'pdf', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts', 'md',
  'jwt', 'oauth', 'smtp', 'imap', 'rss', 'rpc', 'sdk', 'iot', 'vpn', 'dns', 'ip',
]);

function beautifySkillName(name: string): string {
  return name
    .split('-')
    .map(word => {
      if (_skillsUpperWords.has(word.toLowerCase())) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function translateInstallLabel(label: string): string {
  const match = label.match(/^Install\s+(.+?)\s*\((\w+)\)$/i);
  if (match) {
    const [, toolName] = match;
    return `${t("playground.oneClickInstall")} ${toolName}`;
  }
  return label;
}

function getLocalizedSkillName(skillName: string): string {
  const normalizedName = skillName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const translationKey = `skillName.${normalizedName}` as const;
  const translated = tMaybe(translationKey);
  if (translated && translated !== translationKey) return translated;
  return beautifySkillName(skillName);
}

function getLocalizedSkillDesc(skillName: string, originalDesc: string): string {
  const normalizedName = skillName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const translationKey = `skillDesc.${normalizedName}` as const;
  const translated = tMaybe(translationKey);
  if (translated && translated !== translationKey) return translated;
  if (originalDesc && originalDesc.trim()) return originalDesc;
  return t("skills.noDescription") || "点击安装了解更多";
}

// ============================================================================
// 分组缓存：避免每次渲染都重新分组
// ============================================================================
type SkillGroups = {
  core: SkillStatusEntry[];
  ready: SkillStatusEntry[];
  blocked: SkillStatusEntry[];
  disabled: SkillStatusEntry[];
};

let _lastSkills: SkillStatusEntry[] | null = null;
let _lastGroups: SkillGroups | null = null;

function getSkillGroups(allSkills: SkillStatusEntry[]): SkillGroups {
  // 如果技能列表引用没变，直接返回缓存
  if (_lastSkills === allSkills && _lastGroups) return _lastGroups;

  // 技能数据变化时清除分类缓存
  _categoryCache.clear();
  _lastCategoryInput = null;
  _lastCategoryResult = null;

  // 先过滤不兼容/隐藏的技能
  const skills = allSkills.filter(s =>
    !isSkillHidden(s.name) &&
    checkPlatformCompatibility(s.name).compatible &&
    (!s.missing?.os || s.missing.os.length === 0)
  );

  // 单次遍历完成分组（O(n) 而非之前的 4*O(n)）
  const core: SkillStatusEntry[] = [];
  const ready: SkillStatusEntry[] = [];
  const blocked: SkillStatusEntry[] = [];
  const disabled: SkillStatusEntry[] = [];

  for (const s of skills) {
    if (s.disabled) {
      disabled.push(s);
    } else if (s.activeInPrompt) {
      core.push(s);
    } else if (s.eligible) {
      ready.push(s);
    } else {
      blocked.push(s);
    }
  }

  _lastSkills = allSkills;
  _lastGroups = { core, ready, blocked, disabled };
  return _lastGroups;
}

// ============================================================================
// 搜索过滤（带缓存）
// ============================================================================
let _lastFilter = "";
let _lastFilterInput: SkillStatusEntry[] | null = null;
let _lastFilterResult: SkillStatusEntry[] | null = null;

function filterSkillList(list: SkillStatusEntry[], filter: string): SkillStatusEntry[] {
  if (!filter) return list;
  if (list === _lastFilterInput && filter === _lastFilter && _lastFilterResult) {
    return _lastFilterResult;
  }
  const result = list.filter(s => {
    const text = [
      s.name,
      s.description,
      getLocalizedSkillName(s.name),
      getLocalizedSkillDesc(s.name, s.description),
    ].join(" ").toLowerCase();
    return text.includes(filter);
  });
  _lastFilter = filter;
  _lastFilterInput = list;
  _lastFilterResult = result;
  return result;
}

// ============================================================================
// 分类过滤（带缓存）
// ============================================================================
let _lastCategoryFilter = "all";
let _lastCategoryInput: SkillStatusEntry[] | null = null;
let _lastCategoryResult: SkillStatusEntry[] | null = null;

function filterSkillsByCategory(list: SkillStatusEntry[], category: string): SkillStatusEntry[] {
  if (category === "all") return list;
  if (list === _lastCategoryInput && category === _lastCategoryFilter && _lastCategoryResult) {
    return _lastCategoryResult;
  }
  const result = list.filter(s => getSkillCategory(s) === category);
  _lastCategoryFilter = category;
  _lastCategoryInput = list;
  _lastCategoryResult = result;
  return result;
}

// ============================================================================
// 分类标签栏（预计算 count，避免渲染时 N*M 遍历）
// ============================================================================
function renderCategoryBar(currentTab: SkillTabId, groups: SkillGroups, props: SkillsProps) {
  // 一次遍历统计当前 tab 下各分类的数量
  const tabSkills = currentTab === "core" ? groups.core
    : currentTab === "ready" ? groups.ready.concat(groups.disabled)
    : groups.blocked;

  const countMap = new Map<string, number>();
  let total = 0;
  for (const s of tabSkills) {
    const cat = getSkillCategory(s);
    countMap.set(cat, (countMap.get(cat) ?? 0) + 1);
    total++;
  }

  return html`
    <div class="skills-category-bar">
      ${SKILL_CATEGORIES.map(cat => {
        const isActive = props.activeCategory === cat.id;
        const count = cat.id === "all" ? total : (countMap.get(cat.id) ?? 0);
        if (cat.id !== "all" && count === 0) return nothing;
        return html`
          <button
            class="skills-category-chip ${isActive ? "skills-category-chip--active" : ""}"
            @click=${() => props.onCategoryChange(isActive && cat.id !== "all" ? "all" : cat.id)}
          >${cat.emoji} ${t(`skills.category.${cat.id}` as never)}${count > 0 ? html` <span class="skills-category-chip__count">${count}</span>` : nothing}</button>
        `;
      })}
    </div>
  `;
}

// ============================================================================
// Props 定义（精简：移除未使用的 market/remote 属性）
// ============================================================================
export type SkillsProps = {
  loading: boolean;
  report: SkillStatusReport | null;
  error: string | null;
  filter: string;
  edits: Record<string, string>;
  busyKey: string | null;
  messages: SkillMessageMap;
  connected: boolean;
  installProgress: Record<string, InstallProgress>;
  activeTab: SkillsTab;
  remoteLoading: boolean;
  remoteIndex: null;
  remoteError: string | null;
  marketLoading: boolean;
  marketResponse: SkillsMarketResponse | null;
  marketSyncing: boolean;
  marketLastSyncedAt: string | null;
  marketError: string | null;
  activeCategory: string;
  visibleCount: number;
  onFilterChange: (next: string) => void;
  onLoadMore: () => void;
  onRefresh: () => void;
  onToggle: (skillKey: string, enabled: boolean) => void;
  onEdit: (skillKey: string, value: string) => void;
  onSaveKey: (skillKey: string) => void;
  onInstall: (skillKey: string, name: string, installId: string) => void;
  onTabChange: (tab: SkillsTab) => void;
  onRefreshRemote: () => void;
  onInstallRemote: (skillName: string) => void;
  onCategoryChange: (category: string) => void;
  onPinToggle: (skillKey: string, pinned: boolean) => void;
};

// ============================================================================
// Loading Spinner
// ============================================================================
function renderSpinner() {
  return html`<span class="skill-spinner">${icons.loader}</span>`;
}

// ============================================================================
// 主渲染函数（优化版：单次分组 + 仅渲染当前 Tab）
// ============================================================================
export function renderSkills(props: SkillsProps) {
  const allSkills = props.report?.skills ?? [];
  const filter = props.filter.trim().toLowerCase();
  const groups = getSkillGroups(allSkills);

  // 当前 Tab
  const currentTab: SkillTabId =
    props.activeTab === "active" ? "core" :
    props.activeTab === "library" ? "ready" :
    props.activeTab === "blocked" ? "blocked" :
    "core";

  // 概览数据
  const report = props.report;
  const maxPrompt = report?.maxPromptSkills ?? 30;

  // 进度环百分比
  const corePercent = Math.round((groups.core.length / maxPrompt) * 100);

  // Tab 对应的技能数量（用于 badge 显示）
  const coreCount = groups.core.length;
  const readyCount = groups.ready.length + groups.disabled.length;
  const blockedCount = groups.blocked.length;

  return html`
    <section class="card skills-page">
      <!-- 标题栏 -->
      <div class="skills-header-bar">
        <div>
          <div class="card-title">${t("skills.cardTitle")}</div>
          <div class="card-sub">${t("skills.cardSub")}</div>
        </div>
        <button
          class="btn skills-refresh-btn"
          ?disabled=${props.loading}
          @click=${props.onRefresh}
        >
          ${props.loading
            ? html`${renderSpinner()} ${t("common.loading")}`
            : html`${icons.refreshCw} ${t("common.refresh")}`}
        </button>
      </div>

      <!-- 概览面板 -->
      <div class="skills-dashboard">
        <div class="skills-dashboard__ring">
          <svg viewBox="0 0 80 80" class="skills-ring-svg">
            <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border)" stroke-width="6" />
            <circle cx="40" cy="40" r="34"
              fill="none" stroke="var(--accent)" stroke-width="6"
              stroke-linecap="round"
              stroke-dasharray="${2 * Math.PI * 34}"
              stroke-dashoffset="${2 * Math.PI * 34 * (1 - Math.min(corePercent, 100) / 100)}"
              transform="rotate(-90 40 40)"
              class="skills-ring-progress"
            />
          </svg>
          <div class="skills-ring-text">
            <span class="skills-ring-value">${coreCount}</span>
            <span class="skills-ring-max">/ ${maxPrompt}</span>
          </div>
        </div>
        <div class="skills-dashboard__stats">
          <button
            class="skills-stat-card ${currentTab === "core" ? "skills-stat-card--active" : ""}"
            @click=${() => props.onTabChange("active")}
          >
            <div class="skills-stat-card__icon skills-stat-card__icon--core">${icons.zap}</div>
            <div class="skills-stat-card__info">
              <span class="skills-stat-card__value">${coreCount}</span>
              <span class="skills-stat-card__label">已激活核心</span>
            </div>
          </button>
          <button
            class="skills-stat-card ${currentTab === "ready" ? "skills-stat-card--active" : ""}"
            @click=${() => props.onTabChange("library")}
          >
            <div class="skills-stat-card__icon skills-stat-card__icon--ready">${icons.checkCircle}</div>
            <div class="skills-stat-card__info">
              <span class="skills-stat-card__value">${readyCount}</span>
              <span class="skills-stat-card__label">就绪候补</span>
            </div>
          </button>
          <button
            class="skills-stat-card ${currentTab === "blocked" ? "skills-stat-card--active" : ""}"
            @click=${() => props.onTabChange("blocked")}
          >
            <div class="skills-stat-card__icon skills-stat-card__icon--blocked">${icons.alertCircle}</div>
            <div class="skills-stat-card__info">
              <span class="skills-stat-card__value">${blockedCount}</span>
              <span class="skills-stat-card__label">缺依赖</span>
            </div>
          </button>
        </div>
      </div>

      <!-- 搜索框 -->
      <div class="skills-search-bar">
        <div class="skills-search-bar__icon">${icons.search}</div>
        <input
          type="text"
          class="skills-search-bar__input"
          .value=${props.filter}
          @input=${(e: Event) => {
            const input = e.target as HTMLInputElement;
            props.onFilterChange(input.value);
          }}
          placeholder="搜索技能名称或描述..."
          autocomplete="off"
        />
        ${props.filter ? html`
          <button
            class="skills-search-bar__clear"
            @click=${() => props.onFilterChange("")}
          >
            ${icons.x}
          </button>
        ` : nothing}
      </div>

      <!-- 分类筛选标签 -->
      ${renderCategoryBar(currentTab, groups, props)}

      <!-- 错误提示 -->
      ${props.error
        ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`
        : nothing}

      <!-- Tab 内容区（仅渲染当前 Tab，其他 Tab 完全不进入 DOM） -->
      ${currentTab === "core"
        ? renderCoreTab(filterSkillList(filterSkillsByCategory(groups.core, props.activeCategory), filter), props, maxPrompt)
        : currentTab === "ready"
          ? renderReadyTab(
              filterSkillList(filterSkillsByCategory(groups.ready, props.activeCategory), filter),
              filterSkillList(filterSkillsByCategory(groups.disabled, props.activeCategory), filter),
              props
            )
          : renderBlockedTab(filterSkillList(filterSkillsByCategory(groups.blocked, props.activeCategory), filter), props)}
    </section>
  `;
}

// ============================================================================
// Tab 1: 已激活核心（参数控制上限，支持卸载）
// ============================================================================
function renderCoreTab(skills: SkillStatusEntry[], props: SkillsProps, maxPrompt: number) {
  if (skills.length === 0) {
    return html`
      <div class="skills-empty-state">
        <div class="skills-empty-state__icon">${icons.zap}</div>
        <div class="skills-empty-state__title">暂无已激活的技能</div>
        <div class="skills-empty-state__desc">前往「就绪候补」添加技能到核心</div>
        <button class="btn primary" style="margin-top: 12px;" @click=${() => props.onTabChange("library")}>
          ${icons.zap} 添加技能
        </button>
      </div>
    `;
  }

  // 分成置顶和普通两组
  const pinned = skills.filter(s => s.pinned);
  const unpinned = skills.filter(s => !s.pinned);

  return html`
    <div class="skills-tab-header">
      <div class="skills-tab-header__title">
        ${icons.zap}
        <span>已激活核心</span>
        <span class="skills-tab-header__badge">${skills.length} / ${maxPrompt}</span>
      </div>
      <div class="skills-tab-header__hint">已加载到 AI 提示词的技能，参数控制上限 ${maxPrompt} 个。支持卸载移出核心</div>
    </div>

    ${pinned.length > 0 ? html`
      <div class="skills-section-label">
        <span class="skills-section-label__icon skills-section-label__icon--auto">📌</span>
        <span>置顶优先 (${pinned.length})</span>
      </div>
      <div class="skills-grid">
        ${pinned.map(skill => renderCoreSkillCard(skill, props))}
      </div>
    ` : nothing}

    ${unpinned.length > 0 ? html`
      ${pinned.length > 0 ? html`
        <div class="skills-section-label" style="margin-top: 12px;">
          <span class="skills-section-label__icon skills-section-label__icon--manual">${icons.zap}</span>
          <span>普通加载 (${unpinned.length})</span>
        </div>
      ` : nothing}
      <div class="skills-grid">
        ${unpinned.map(skill => renderCoreSkillCard(skill, props))}
      </div>
    ` : nothing}
  `;
}

// ============================================================================
// Tab 2: 就绪候补（可添加到核心）
// ============================================================================
function renderReadyTab(readySkills: SkillStatusEntry[], disabledSkills: SkillStatusEntry[], props: SkillsProps) {
  const total = readySkills.length + disabledSkills.length;

  if (total === 0) {
    return html`
      <div class="skills-empty-state">
        <div class="skills-empty-state__icon">${icons.checkCircle}</div>
        <div class="skills-empty-state__title">没有就绪的候补技能</div>
        <div class="skills-empty-state__desc">所有可用技能已在核心中，或查看「缺依赖」安装更多</div>
      </div>
    `;
  }

  return html`
    <div class="skills-tab-header">
      <div class="skills-tab-header__title">
        ${icons.checkCircle}
        <span>就绪候补</span>
        <span class="skills-tab-header__badge skills-tab-header__badge--ready">${total}</span>
      </div>
      <div class="skills-tab-header__hint">依赖已满足，可随时添加到核心。置顶可优先加载</div>
    </div>

    ${readySkills.length > 0 ? html`
      <div class="skills-grid">
        ${readySkills.map(skill => renderReadySkillCard(skill, props))}
      </div>
    ` : nothing}

    ${disabledSkills.length > 0 ? html`
      <div class="skills-section-divider">
        <span class="skills-section-divider__label">${icons.shieldOff} 已禁用 (${disabledSkills.length})</span>
      </div>
      <div class="skills-grid">
        ${disabledSkills.map(skill => renderDisabledSkillCard(skill, props))}
      </div>
    ` : nothing}
  `;
}

// ============================================================================
// Tab 3: 缺依赖（支持安装依赖 + 加入核心）
// ============================================================================
function renderBlockedTab(skills: SkillStatusEntry[], props: SkillsProps) {
  if (skills.length === 0) {
    return html`
      <div class="skills-empty-state">
        <div class="skills-empty-state__icon">${icons.checkCircle}</div>
        <div class="skills-empty-state__title">所有技能依赖已满足</div>
        <div class="skills-empty-state__desc">太棒了！没有需要处理的依赖问题</div>
      </div>
    `;
  }

  // 分组：可自动安装 vs 需手动安装
  const isAutoInstallable = (s: SkillStatusEntry) =>
    s.install.length > 0 && (s.missing.bins.length > 0 || s.install.some(opt => opt.kind === "download"));
  const autoInstallable = skills.filter(s => isAutoInstallable(s));
  const needsManual = skills.filter(s => !isAutoInstallable(s));

  return html`
    <div class="skills-tab-header">
      <div class="skills-tab-header__title">
        ${icons.alertCircle}
        <span>缺依赖</span>
        <span class="skills-tab-header__badge skills-tab-header__badge--blocked">${skills.length}</span>
      </div>
      <div class="skills-tab-header__hint">安装缺少的依赖后，自动就绪可添加到核心</div>
    </div>

    ${autoInstallable.length > 0 ? html`
      <div class="skills-section-label">
        <span class="skills-section-label__icon skills-section-label__icon--auto">${icons.download}</span>
        <span>可自动安装 (${autoInstallable.length})</span>
      </div>
      <div class="skills-grid">
        ${autoInstallable.map(skill => renderBlockedSkillCard(skill, props))}
      </div>
    ` : nothing}

    ${needsManual.length > 0 ? html`
      <div class="skills-section-label" style="margin-top: 16px;">
        <span class="skills-section-label__icon skills-section-label__icon--manual">${icons.wrench}</span>
        <span>需手动处理 (${needsManual.length})</span>
      </div>
      <div class="skills-grid">
        ${needsManual.map(skill => renderBlockedSkillCard(skill, props))}
      </div>
    ` : nothing}
  `;
}

// ============================================================================
// 技能卡片 — 核心已激活（支持卸载）
// ============================================================================
function renderCoreSkillCard(skill: SkillStatusEntry, props: SkillsProps) {
  const busy = props.busyKey === skill.skillKey;
  const message = props.messages[skill.skillKey] ?? null;
  const localizedName = (skill as any).nameZh || getLocalizedSkillName(skill.name);
  const localizedDesc = (skill as any).descriptionZh || getLocalizedSkillDesc(skill.name, skill.description);

  return html`
    <div class="skill-card-v2 skill-card-v2--core">
      <div class="skill-card-v2__main">
        <div class="skill-card-v2__icon skill-card-v2__icon--core">
          ${skill.emoji ? html`<span class="skill-card-v2__emoji">${skill.emoji}</span>` : icons.zap}
        </div>
        <div class="skill-card-v2__body">
          <div class="skill-card-v2__title-row">
            <span class="skill-card-v2__name">${localizedName}</span>
            ${skill.pinned ? html`<span class="skill-card-v2__pin-badge">置顶</span>` : nothing}
            <span class="skill-card-v2__source">${skill.source}</span>
          </div>
          <div class="skill-card-v2__desc">${clampText(localizedDesc, 120)}</div>
        </div>
      </div>
      <div class="skill-card-v2__actions">
        <button
          class="skill-card-v2__action-btn ${skill.pinned ? "skill-card-v2__action-btn--pinned" : ""}"
          ?disabled=${busy}
          @click=${() => props.onPinToggle(skill.skillKey, !skill.pinned)}
          title="${skill.pinned ? "取消置顶" : "置顶优先加载"}"
        >
          ${skill.pinned ? "📌" : "📍"}
        </button>
        <button
          class="btn btn--sm skill-card-v2__unload-btn"
          ?disabled=${busy}
          @click=${() => props.onToggle(skill.skillKey, false)}
          title="卸载（移出核心）"
        >
          ${busy ? renderSpinner() : icons.x}
          <span>卸载</span>
        </button>
      </div>
      ${message ? html`
        <div class="skill-card-v2__message skill-card-v2__message--${message.kind}">
          ${message.message}
        </div>
      ` : nothing}
    </div>
  `;
}

// ============================================================================
// 技能卡片 — 就绪候补
// ============================================================================
function renderReadySkillCard(skill: SkillStatusEntry, props: SkillsProps) {
  const busy = props.busyKey === skill.skillKey;
  const message = props.messages[skill.skillKey] ?? null;
  const apiKey = props.edits[skill.skillKey] ?? "";
  const localizedName = (skill as any).nameZh || getLocalizedSkillName(skill.name);
  const localizedDesc = (skill as any).descriptionZh || getLocalizedSkillDesc(skill.name, skill.description);
  const downloadInstalls = skill.install.filter(opt => opt.kind === "download");

  return html`
    <div class="skill-card-v2 skill-card-v2--ready">
      <div class="skill-card-v2__main">
        <div class="skill-card-v2__icon skill-card-v2__icon--ready">
          ${skill.emoji ? html`<span class="skill-card-v2__emoji">${skill.emoji}</span>` : icons.checkCircle}
        </div>
        <div class="skill-card-v2__body">
          <div class="skill-card-v2__title-row">
            <span class="skill-card-v2__name">${localizedName}</span>
            <span class="skill-card-v2__source">${skill.source}</span>
          </div>
          <div class="skill-card-v2__desc">${clampText(localizedDesc, 120)}</div>
        </div>
      </div>
      <div class="skill-card-v2__actions">
        <button
          class="skill-card-v2__action-btn ${skill.pinned ? "skill-card-v2__action-btn--pinned" : ""}"
          ?disabled=${busy}
          @click=${() => props.onPinToggle(skill.skillKey, !skill.pinned)}
          title="${skill.pinned ? "取消置顶" : "置顶优先加载"}"
        >
          ${skill.pinned ? "📌" : "📍"}
        </button>
        <button
          class="btn btn--sm primary skill-card-v2__add-btn"
          ?disabled=${busy}
          @click=${() => props.onToggle(skill.skillKey, true)}
          title="添加到核心"
        >
          ${busy ? renderSpinner() : icons.zap}
          <span>加入核心</span>
        </button>
      </div>

      ${downloadInstalls.length > 0 ? html`
        <div class="skill-card-v2__downloads">
          ${downloadInstalls.map(opt => html`
            <button
              class="btn btn--sm skill-card-v2__install-btn"
              ?disabled=${busy}
              @click=${() => props.onInstall(skill.skillKey, skill.name, opt.id)}
            >
              ${busy ? html`${renderSpinner()} 下载中...` : html`${icons.download} ${opt.label}`}
            </button>
          `)}
        </div>
      ` : nothing}

      ${skill.primaryEnv ? html`
        <div class="skill-card-v2__apikey">
          <div class="skill-card-v2__apikey-field">
            <span class="skill-card-v2__apikey-label">${t("skills.apiKey")}</span>
            <input
              type="password"
              .value=${apiKey}
              @input=${(e: Event) => props.onEdit(skill.skillKey, (e.target as HTMLInputElement).value)}
            />
          </div>
          <button
            class="btn primary btn--sm"
            ?disabled=${busy}
            @click=${() => props.onSaveKey(skill.skillKey)}
          >
            ${t("skills.saveKey")}
          </button>
        </div>
      ` : nothing}

      ${message ? html`
        <div class="skill-card-v2__message skill-card-v2__message--${message.kind}">
          ${message.message}
        </div>
      ` : nothing}
    </div>
  `;
}

// ============================================================================
// 技能卡片 — 已禁用
// ============================================================================
function renderDisabledSkillCard(skill: SkillStatusEntry, props: SkillsProps) {
  const busy = props.busyKey === skill.skillKey;
  const localizedName = (skill as any).nameZh || getLocalizedSkillName(skill.name);
  const localizedDesc = (skill as any).descriptionZh || getLocalizedSkillDesc(skill.name, skill.description);

  return html`
    <div class="skill-card-v2 skill-card-v2--disabled">
      <div class="skill-card-v2__main">
        <div class="skill-card-v2__icon skill-card-v2__icon--disabled">
          ${icons.shieldOff}
        </div>
        <div class="skill-card-v2__body">
          <div class="skill-card-v2__title-row">
            <span class="skill-card-v2__name">${localizedName}</span>
            <span class="skill-card-v2__badge skill-card-v2__badge--disabled">已禁用</span>
          </div>
          <div class="skill-card-v2__desc">${clampText(localizedDesc, 120)}</div>
        </div>
      </div>
      <div class="skill-card-v2__actions">
        <button
          class="btn btn--sm skill-card-v2__enable-btn"
          ?disabled=${busy}
          @click=${() => props.onToggle(skill.skillKey, true)}
        >
          ${busy ? renderSpinner() : icons.zap}
          <span>启用</span>
        </button>
      </div>
    </div>
  `;
}

// ============================================================================
// 技能卡片 — 缺依赖（支持安装依赖 + 增加到核心）
// ============================================================================
function renderBlockedSkillCard(skill: SkillStatusEntry, props: SkillsProps) {
  const busy = props.busyKey === skill.skillKey;
  const message = props.messages[skill.skillKey] ?? null;
  const apiKey = props.edits[skill.skillKey] ?? "";
  const hasDownloadInstall = skill.install.some(opt => opt.kind === "download");
  const canInstall = skill.install.length > 0 && (skill.missing.bins.length > 0 || hasDownloadInstall);
  const localizedName = (skill as any).nameZh || getLocalizedSkillName(skill.name);
  const localizedDesc = (skill as any).descriptionZh || getLocalizedSkillDesc(skill.name, skill.description);

  return html`
    <div class="skill-card-v2 skill-card-v2--blocked">
      <div class="skill-card-v2__main">
        <div class="skill-card-v2__icon skill-card-v2__icon--blocked">
          ${icons.alertCircle}
        </div>
        <div class="skill-card-v2__body">
          <div class="skill-card-v2__title-row">
            <span class="skill-card-v2__name">${localizedName}</span>
            <span class="skill-card-v2__source">${skill.source}</span>
          </div>
          <div class="skill-card-v2__desc">${clampText(localizedDesc, 120)}</div>

          <!-- 缺失详情 -->
          <div class="skill-card-v2__missing">
            ${skill.missing.bins.length > 0 ? html`
              <div class="skill-card-v2__missing-row">
                <span class="skill-card-v2__missing-icon">${icons.terminal}</span>
                <span class="skill-card-v2__missing-items">${skill.missing.bins.join(", ")}</span>
                <span class="skill-card-v2__missing-hint">${canInstall ? "可自动安装" : "需手动安装"}</span>
              </div>
            ` : nothing}
            ${skill.missing.env.length > 0 ? html`
              <div class="skill-card-v2__missing-row">
                <span class="skill-card-v2__missing-icon">${icons.key}</span>
                <span class="skill-card-v2__missing-items">${skill.missing.env.join(", ")}</span>
                <span class="skill-card-v2__missing-hint">${skill.primaryEnv ? "填写下方密钥" : "在设置中配置"}</span>
              </div>
            ` : nothing}
            ${skill.missing.config.length > 0 ? html`
              <div class="skill-card-v2__missing-row">
                <span class="skill-card-v2__missing-icon">${icons.settings}</span>
                <span class="skill-card-v2__missing-items">${skill.missing.config.join(", ")}</span>
                <span class="skill-card-v2__missing-hint">前往设置页配置</span>
              </div>
            ` : nothing}
          </div>
        </div>
      </div>

      <div class="skill-card-v2__actions">
        ${canInstall ? html`
          ${skill.install.map(opt => html`
            <button
              class="btn btn--sm primary skill-card-v2__install-btn"
              ?disabled=${busy}
              @click=${() => props.onInstall(skill.skillKey, skill.name, opt.id)}
            >
              ${busy ? html`${renderSpinner()} 安装中...` : html`${icons.download} ${translateInstallLabel(opt.label)}`}
            </button>
          `)}
        ` : nothing}
      </div>

      ${skill.primaryEnv ? html`
        <div class="skill-card-v2__apikey">
          <div class="skill-card-v2__apikey-field">
            <span class="skill-card-v2__apikey-label">${t("skills.apiKey")}</span>
            <input
              type="password"
              .value=${apiKey}
              @input=${(e: Event) => props.onEdit(skill.skillKey, (e.target as HTMLInputElement).value)}
            />
          </div>
          <button
            class="btn primary btn--sm"
            ?disabled=${busy}
            @click=${() => props.onSaveKey(skill.skillKey)}
          >
            ${t("skills.saveKey")}
          </button>
        </div>
      ` : nothing}

      ${message ? html`
        <div class="skill-card-v2__message skill-card-v2__message--${message.kind}">
          ${message.message}
        </div>
      ` : nothing}
    </div>
  `;
}
