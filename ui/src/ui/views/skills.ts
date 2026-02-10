import { html, nothing } from "lit";

import { clampText } from "../format";
import { t, tMaybe } from "../i18n/index.js";
import { icons } from "../icons.js";
import type { RemoteSkillMeta, RemoteSkillsIndex, SkillStatusEntry, SkillStatusReport, SkillsMarketResponse, MarketSkillMeta } from "../types";
import type { SkillMessageMap, SkillsTab, InstallProgress } from "../controllers/skills";
import { CATEGORIES as PLAYGROUND_CATEGORIES, categorizeSkill } from "./playground.js";

// ============================================================================
// 平台兼容性检测
// ============================================================================

/** 获取当前平台 */
function getCurrentPlatform(): "win32" | "darwin" | "linux" {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "win32";
  if (ua.includes("mac")) return "darwin";
  return "linux";
}

/** macOS 专属技能的关键词 */
const MACOS_ONLY_KEYWORDS = [
  "apple", "macos", "mac-os", "osx", "swiftui", "swift-ui",
  "bear-notes", "bear-note", "reminders", "apple-mail", "apple-notes",
  "apple-music", "apple-calendar", "apple-contacts", "apple-photos",
  "finder", "spotlight", "shortcuts", "raycast", "alfred",
  "homebrew", "brew-", "-brew", "xcode", "xcrun", "osascript",
  "coreml", "core-ml", "appkit", "uikit", "cocoa",
  "imessage", "facetime", "airdrop", "keychain", "launchd",
];

/** Windows 专属技能的关键词 */
const WINDOWS_ONLY_KEYWORDS = [
  "windows", "win32", "win64", "powershell", "cmd-", "-cmd",
  "registry", "wsl", "winget", "msedge", "outlook-win",
  "notepad", "explorer-", "taskbar", "cortana",
];

/** Linux 专属技能的关键词 */
const LINUX_ONLY_KEYWORDS = [
  "linux", "ubuntu", "debian", "fedora", "centos", "arch-linux",
  "systemd", "apt-get", "yum", "dnf", "pacman",
  "gnome", "kde", "xorg", "wayland",
];

// ============================================================================
// 隐藏技能列表（ClawdbotCN 专属）
// ============================================================================

/**
 * 在 ClawdbotCN 中隐藏的技能列表
 * 这些技能对中国用户没有意义或已被国内服务替代
 */
const HIDDEN_SKILLS_CN = [
  "clawdhub", // 国际版技能市场CLI工具，已被内置技能市场替代
];

/**
 * 检查技能是否应该被隐藏
 * @param skillName 技能名称或ID
 * @returns true 表示应该隐藏
 */
function isSkillHidden(skillName: string): boolean {
  return HIDDEN_SKILLS_CN.includes(skillName.toLowerCase());
}

/**
 * 检测技能是否兼容当前平台
 * @returns { compatible: boolean, requiredPlatform?: string }
 */
function checkPlatformCompatibility(skillName: string): { compatible: boolean; requiredPlatform?: string } {
  const platform = getCurrentPlatform();
  const name = skillName.toLowerCase();
  
  // 检测 macOS-only
  if (MACOS_ONLY_KEYWORDS.some(kw => name.includes(kw))) {
    if (platform !== "darwin") {
      return { compatible: false, requiredPlatform: "macOS" };
    }
  }
  
  // 检测 Windows-only
  if (WINDOWS_ONLY_KEYWORDS.some(kw => name.includes(kw))) {
    if (platform !== "win32") {
      return { compatible: false, requiredPlatform: "Windows" };
    }
  }
  
  // 检测 Linux-only
  if (LINUX_ONLY_KEYWORDS.some(kw => name.includes(kw))) {
    if (platform !== "linux") {
      return { compatible: false, requiredPlatform: "Linux" };
    }
  }
  
  return { compatible: true };
}

// ============================================================================
// 技能名称本地化辅助函数
// ============================================================================

/**
 * 美化技能名称（kebab-case 转 Title Case）
 * 例如：api-credentials-hygiene -> API Credentials Hygiene
 */
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

/**
 * 翻译安装按钮标签
 * 将 "Install xxx (go)" 翻译成 "一键安装 xxx"
 */
function translateInstallLabel(label: string): string {
  // 匹配 "Install xxx (go/brew/node/uv)" 格式
  const match = label.match(/^Install\s+(.+?)\s*\((\w+)\)$/i);
  if (match) {
    const [, toolName] = match;
    return `${t("playground.oneClickInstall")} ${toolName}`;
  }
  // 其他格式直接返回
  return label;
}

/**
 * 获取技能的本地化显示名称
 * 优先显示翻译后的中文名，如果没有翻译则美化原始名称
 */
function getLocalizedSkillName(skillName: string): string {
  // 尝试获取翻译
  const normalizedName = skillName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const translationKey = `skillName.${normalizedName}` as const;
  const translated = tMaybe(translationKey);
  
  // 如果有翻译，返回翻译后的名称
  if (translated && translated !== translationKey) {
    return translated;
  }
  
  // 没有翻译则美化原始名称
  return beautifySkillName(skillName);
}

/**
 * 获取技能的本地化描述
 * 如果没有翻译且原始描述为空，返回默认提示
 */
function getLocalizedSkillDesc(skillName: string, originalDesc: string): string {
  const normalizedName = skillName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const translationKey = `skillDesc.${normalizedName}` as const;
  const translated = tMaybe(translationKey);
  
  // 有翻译则使用翻译
  if (translated && translated !== translationKey) {
    return translated;
  }
  
  // 有原始描述则使用原始描述
  if (originalDesc && originalDesc.trim()) {
    return originalDesc;
  }
  
  // 没有描述则返回默认提示
  return t("skills.noDescription") || "点击安装了解更多";
}

/**
 * 获取 tag 本地化名称
 * 优先使用 i18n 翻译，否则原样返回（proxy 已可能返回中文 tag）
 */
function getLocalizedTag(tag: string): string {
  const key = `skillTag.${tag.toLowerCase().replace(/[^a-z0-9-]/g, '-')}` as const;
  const translated = tMaybe(key);
  return (translated && translated !== key) ? translated : tag;
}

// ============================================================================
// Skills 分类定义 — 复用 Playground 的统一分类体系
// 两个页面共享同一套 categorizeSkill + CATEGORIES，保证用户心智模型一致
// ============================================================================
export type SkillCategory = {
  id: string;
  emoji: string;
  labelKey: string;
  descKey: string;
};

// 从 playground 导入的 CATEGORIES 不含 "all"，这里补上作为首项
export const SKILL_CATEGORIES: SkillCategory[] = [
  { id: "all", emoji: "✨", labelKey: "skills.category.all", descKey: "skills.category.allDesc" },
  ...PLAYGROUND_CATEGORIES,
];

// ============================================================================
// 语义搜索同义词索引（仅用于搜索框智能提示，分类逻辑已统一到 categorizeSkill）
// ============================================================================
const SKILL_SEARCH_SYNONYMS: Record<string, string[]> = {
  finance: ["股票", "炒股", "行情", "涨跌", "A股", "港股", "美股", "基金", "理财", "记账", "投资", "财务", "金融", "加密", "比特币"],
  entertainment: ["音乐", "游戏", "视频", "播放", "GIF", "动图", "播客", "娱乐", "休闲"],
  work: ["笔记", "备忘录", "提醒", "日历", "待办", "任务", "密码", "效率", "办公", "工作", "日程", "邮件", "邮箱"],
  lifestyle: ["天气", "外卖", "点餐", "美食", "地图", "附近", "餐厅", "智能家居", "家居", "生活", "健康", "运动", "旅行"],
  creative: ["图片", "图像", "生成", "画图", "绘画", "创作", "设计", "总结", "摘要", "创意", "语音", "TTS", "翻译"],
  communication: ["微信", "消息", "聊天", "发送", "通讯", "社交", "联系", "群组", "频道", "语音", "通话"],
  development: ["代码", "编程", "开发", "GitHub", "仓库", "PR", "调试", "测试", "部署", "API", "接口", "搜索", "数据库"],
  system: ["截图", "屏幕", "摄像头", "文件", "系统", "终端", "命令行", "桌面", "安全", "备份", "VPN"],
};

// 智能搜索：支持关键词和同义词匹配
function smartSearchSkills<T extends { name: string; description: string; nameZh?: string; descriptionZh?: string; tags?: string[] }>(
  skills: T[],
  query: string,
): { matched: T[]; category: string | null } {
  if (!query.trim()) {
    return { matched: skills, category: null };
  }

  const lowerQuery = query.toLowerCase().trim();
  
  // 1. 先检查是否匹配某个分类的同义词（用户可能在描述场景）
  let matchedCategory: string | null = null;
  for (const [category, synonyms] of Object.entries(SKILL_SEARCH_SYNONYMS)) {
    for (const synonym of synonyms) {
      if (lowerQuery.includes(synonym.toLowerCase()) || synonym.toLowerCase().includes(lowerQuery)) {
        matchedCategory = category;
        break;
      }
    }
    if (matchedCategory) break;
  }

  // 2. 过滤 skills
  const matched = skills.filter((skill) => {
    const searchText = [
      skill.name,
      skill.description,
      skill.nameZh,
      skill.descriptionZh,
      ...(skill.tags ?? []),
    ].filter(Boolean).join(" ").toLowerCase();

    // 直接文本匹配
    if (searchText.includes(lowerQuery)) {
      return true;
    }

    // 如果匹配到分类，返回该分类下的所有 skills（使用统一的 categorizeSkill）
    if (matchedCategory) {
      return categorizeSkill(skill.name) === matchedCategory;
    }

    return false;
  });

  return { matched, category: matchedCategory };
}

export type SkillsProps = {
  loading: boolean;
  report: SkillStatusReport | null;
  error: string | null;
  filter: string;
  edits: Record<string, string>;
  busyKey: string | null;
  messages: SkillMessageMap;
  // 连接状态
  connected: boolean;
  // 安装进度
  installProgress: Record<string, InstallProgress>;
  // Tab and remote (legacy)
  activeTab: SkillsTab;
  remoteLoading: boolean;
  remoteIndex: RemoteSkillsIndex | null;
  remoteError: string | null;
  // Market (new)
  marketLoading: boolean;
  marketResponse: SkillsMarketResponse | null;
  marketSyncing: boolean;
  marketLastSyncedAt: string | null;
  marketError: string | null;
  // Category filter (new)
  activeCategory: string;
  // Pagination
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

// 格式化相对时间
function formatRelativeTime(isoTime: string | null): string {
  if (!isoTime) return "";
  const date = new Date(isoTime);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffMin < 1) return t("skills.time.justNow") || "刚刚";
  if (diffMin < 60) return (t("skills.time.minutesAgo") || "{{count}} 分钟前").replace("{{count}}", String(diffMin));
  if (diffHour < 24) return (t("skills.time.hoursAgo") || "{{count}} 小时前").replace("{{count}}", String(diffHour));
  return (t("skills.time.daysAgo") || "{{count}} 天前").replace("{{count}}", String(diffDay));
}

// Loading Spinner Component
function renderSpinner() {
  return html`<span class="skill-spinner">${icons.loader}</span>`;
}

export function renderSkills(props: SkillsProps) {
  const allSkills = props.report?.skills ?? [];
  const filter = props.filter.trim();
  const activeCategory = props.activeCategory || "all";
  const visibleCount = props.visibleCount || 50;

  // 优先使用新的市场数据，兼容旧的 remoteIndex
  const allMarketSkills = props.marketResponse?.skills ?? props.remoteIndex?.skills ?? [];

  // 过滤掉隐藏的技能 + 不兼容当前操作系统的技能（直接不显示）
  const skills = allSkills.filter(s =>
    !isSkillHidden(s.name) &&
    checkPlatformCompatibility(s.name).compatible &&
    (!s.missing?.os || s.missing.os.length === 0)
  );
  const marketSkills = allMarketSkills.filter(s =>
    !isSkillHidden(s.name) &&
    checkPlatformCompatibility(s.name).compatible
  );

  // === Active tab data ===
  // 仅 activeInPrompt 的技能（实际加载进 AI prompt 的，不需要搜索过滤）
  const activePromptSkills = skills.filter(s => s.activeInPrompt);

  // === Library tab data ===
  const { matched: searchMatchedMarket, category: detectedCategory } = smartSearchSkills(
    marketSkills,
    filter,
  );
  const filteredMarket = activeCategory === "all"
    ? searchMatchedMarket
    : searchMatchedMarket.filter(skill => categorizeSkill(skill.name) === activeCategory);

  // 非活跃本地技能（需要关注的：缺依赖或已禁用）
  const needsAttention = skills.filter(s =>
    !s.activeInPrompt && (!s.eligible || s.disabled)
  );

  // 同步状态
  const isSyncing = props.marketSyncing || props.marketLoading;
  const lastSyncedAt = props.marketLastSyncedAt ?? props.remoteIndex?.updated ?? null;

  // 分页：只对 Library tab 生效（Active tab 展示全部 ~30 条）
  const isActiveTab = props.activeTab === "active";
  const libraryTotal = filteredMarket.length;
  const pagedMarket = filteredMarket.slice(0, visibleCount);
  const hasMore = libraryTotal > visibleCount;
  const remaining = libraryTotal - visibleCount;

  // 搜索无结果提示（仅 Library tab）
  const showNoResultsHint = !isActiveTab && filter.trim() && libraryTotal === 0;

  // 分类数量（仅 library tab 使用）— 单次遍历 O(N) 替代原来的 O(C*N)
  const categoryCounts = new Map<string, number>();
  if (!isActiveTab) {
    categoryCounts.set("all", searchMatchedMarket.length);
    for (const s of searchMatchedMarket) {
      const cat = categorizeSkill(s.name);
      categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
    }
  }

  // 概览数据
  const report = props.report;
  const activeCount = report?.activeCount ?? 0;
  const maxPrompt = report?.maxPromptSkills ?? 30;
  const eligibleCount = skills.filter(s => s.eligible && !s.activeInPrompt).length;
  const blockedCount = skills.filter(s => !s.eligible && !s.disabled).length;
  const disabledCount = skills.filter(s => s.disabled).length;

  return html`
    <section class="card">
      <!-- 标题栏 -->
      <div class="row" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="card-title">${t("skills.cardTitle")}</div>
          <div class="card-sub">${t("skills.cardSub")}</div>
        </div>
        <button
          class="btn"
          ?disabled=${props.loading || props.remoteLoading || isSyncing}
          @click=${isActiveTab ? props.onRefresh : props.onRefreshRemote}
        >
          ${(isActiveTab ? props.loading : (props.remoteLoading || isSyncing))
            ? html`${renderSpinner()} ${t("common.loading")}`
            : html`${icons.refreshCw} ${t("common.refresh")}`}
        </button>
      </div>

      <!-- Tab 切换 -->
      <div class="skills-tabs" style="margin-top: 16px;">
        <button
          class="skills-tab ${isActiveTab ? "skills-tab--active" : ""}"
          @click=${() => props.onTabChange("active")}
        >
          ${icons.zap}
          <span>${t("skills.tab.active")}</span>
          <span class="skills-tab-count">${activeCount}</span>
        </button>
        <button
          class="skills-tab ${!isActiveTab ? "skills-tab--active" : ""}"
          @click=${() => props.onTabChange("library")}
        >
          ${icons.layers}
          <span>${t("skills.tab.library")}</span>
          <span class="skills-tab-count">${marketSkills.length}</span>
          ${isSyncing ? renderSpinner() : nothing}
        </button>
      </div>

      <!-- 概览条（Active tab） -->
      ${isActiveTab && report ? html`
        <div class="skills-overview-bar" style="margin-top: 16px;">
          <div class="skills-overview-bar__stat">
            <span class="skills-overview-bar__dot skills-overview-bar__dot--active"></span>
            <span class="skills-overview-bar__value">${activeCount}</span>
            <span class="skills-overview-bar__label">${t("skills.overview.active")}</span>
            <span class="skills-overview-bar__label muted">/ ${maxPrompt}</span>
          </div>
          <div class="skills-overview-bar__sep"></div>
          <div class="skills-overview-bar__stat" title="${t("skills.overview.eligibleTooltip")}">
            <span class="skills-overview-bar__dot skills-overview-bar__dot--eligible"></span>
            <span class="skills-overview-bar__value">${eligibleCount}</span>
            <span class="skills-overview-bar__label">${t("skills.overview.eligible")}</span>
          </div>
          ${blockedCount > 0 ? html`
            <div class="skills-overview-bar__sep"></div>
            <div class="skills-overview-bar__stat">
              <span class="skills-overview-bar__dot skills-overview-bar__dot--blocked"></span>
              <span class="skills-overview-bar__value">${blockedCount}</span>
              <span class="skills-overview-bar__label">${t("skills.overview.blocked")}</span>
            </div>
          ` : nothing}
          ${disabledCount > 0 ? html`
            <div class="skills-overview-bar__sep"></div>
            <div class="skills-overview-bar__stat">
              <span class="skills-overview-bar__dot skills-overview-bar__dot--disabled"></span>
              <span class="skills-overview-bar__value">${disabledCount}</span>
              <span class="skills-overview-bar__label">${t("skills.overview.disabled")}</span>
            </div>
          ` : nothing}
        </div>
      ` : nothing}

      <!-- 搜索框（仅 Library tab，Active tab ~30条无需搜索） -->
      ${!isActiveTab ? html`
        <div class="skills-smart-search" style="margin-top: 16px;">
          <div class="skills-smart-search__icon">${icons.search}</div>
          <input
            type="text"
            class="skills-smart-search__input"
            .value=${props.filter}
            @input=${(e: Event) => {
              const input = e.target as HTMLInputElement;
              props.onFilterChange(input.value);
            }}
            @focus=${(e: Event) => {
              const input = e.target as HTMLInputElement;
              if (input.value !== props.filter) {
                input.value = props.filter;
              }
            }}
            placeholder="${t("skills.search.placeholder")}"
            autocomplete="off"
          />
          ${filter ? html`
            <button
              class="skills-smart-search__clear"
              @click=${() => props.onFilterChange("")}
              title="${t("common.close")}"
            >
              ${icons.x}
            </button>
          ` : nothing}
        </div>
      ` : nothing}

      <!-- 搜索智能提示 + 分类导航（仅 Library tab） -->
      ${!isActiveTab ? html`
        ${detectedCategory && filter ? html`
          <div class="skills-search-hint" style="margin-top: 8px;">
            ${icons.lightbulb}
            <span>${t("skills.search.detected")}: </span>
            <button
              class="skills-search-hint__link"
              @click=${() => {
                props.onCategoryChange(detectedCategory);
                props.onFilterChange("");
              }}
            >
              ${tMaybe(`skills.category.${detectedCategory}`)}
            </button>
          </div>
        ` : nothing}

        <div class="skills-categories__list" style="margin-top: 12px;">
          ${SKILL_CATEGORIES.map(cat => {
            const count = categoryCounts.get(cat.id) ?? 0;
            if (cat.id !== "all" && count === 0) return nothing;
            return html`
              <button
                class="skills-category-chip ${activeCategory === cat.id ? "skills-category-chip--active" : ""}"
                @click=${() => props.onCategoryChange(cat.id)}
                title="${tMaybe(cat.descKey)}"
              >
                <span class="skills-category-chip__emoji">${cat.emoji}</span>
                <span class="skills-category-chip__label">${tMaybe(cat.labelKey)}</span>
                <span class="skills-category-chip__count">${count}</span>
              </button>
            `;
          })}
        </div>
      ` : nothing}

      <!-- 结果统计栏（仅 Library tab） -->
      ${!isActiveTab ? html`
        <div class="skills-results-bar" style="margin-top: 14px;">
          <div class="skills-results-count">
            ${libraryTotal} ${t("skills.shown")}
            ${filter ? html`<span class="muted"> · "${filter}"</span>` : nothing}
            ${activeCategory !== "all" ? html`<span class="muted"> · ${tMaybe(`skills.category.${activeCategory}`)}</span>` : nothing}
          </div>
          ${(filter || activeCategory !== "all") ? html`
            <button
              class="btn btn--sm btn--ghost"
              @click=${() => {
                props.onFilterChange("");
                props.onCategoryChange("all");
              }}
            >
              ${icons.x} ${t("skills.clearFilters")}
            </button>
          ` : nothing}
        </div>
      ` : nothing}

      <!-- 内容区 -->
      ${isActiveTab ? html`
        ${props.error
          ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`
          : nothing}

        ${activePromptSkills.length === 0
          ? renderEmptyState(props.loading, "active", props.onTabChange)
          : html`
              <div class="skills-list" style="margin-top: 16px;">
                ${activePromptSkills.map((skill) => renderSkill(skill, props))}
              </div>
            `}

        <!-- 需要关注的本地技能（缺依赖/已禁用） -->
        ${needsAttention.length > 0 ? html`
          <div class="skills-attention" style="margin-top: 16px;">
            <div class="skills-attention__header">
              ${icons.alertCircle}
              <span>${t("skills.attention.title")} (${needsAttention.length})</span>
            </div>
            <div class="skills-list" style="margin-top: 8px;">
              ${needsAttention.map((skill) => renderSkill(skill, props))}
            </div>
          </div>
        ` : nothing}
      ` : html`
        ${props.marketError || props.remoteError
          ? html`<div class="callout danger" style="margin-top: 12px;">${props.marketError || props.remoteError}</div>`
          : nothing}

        <!-- Sync Status Bar -->
        ${lastSyncedAt || isSyncing
          ? html`
              <div class="skills-sync-bar ${isSyncing ? "skills-sync-bar--syncing" : ""}" style="margin-top: 12px;">
                ${isSyncing
                  ? html`${renderSpinner()} <span>${t("skills.market.syncing") || "正在同步..."}</span>`
                  : html`${icons.clock} <span>${t("skills.remote.updated")}: ${formatRelativeTime(lastSyncedAt)}</span>`}
                ${props.marketResponse?.message && !props.marketError
                  ? html`<span class="muted" style="margin-left: auto;">${props.marketResponse.message}</span>`
                  : nothing}
              </div>
            `
          : nothing}

        ${libraryTotal === 0
          ? showNoResultsHint
            ? renderNoResultsHint(filter, props)
            : renderEmptyState(isSyncing, "library")
          : html`
              <div class="skills-list" style="margin-top: 16px;">
                ${pagedMarket.map((skill) => renderRemoteSkill(skill as RemoteSkillMeta, props))}
              </div>
              ${hasMore ? html`
                <div class="skills-load-more" style="margin-top: 16px; text-align: center;">
                  <button
                    class="btn btn--sm"
                    @click=${() => props.onLoadMore()}
                  >
                    ${t("skills.loadMore") || `加载更多（还有 ${remaining} 个）`}
                  </button>
                </div>
              ` : nothing}
            `}
      `}
    </section>
  `;
}

// 没找到结果时的引导提示
function renderNoResultsHint(query: string, _props: SkillsProps) {
  return html`
    <div class="skills-no-results">
      <div class="skills-no-results__icon">${icons.searchX}</div>
      <div class="skills-no-results__title">${t("skills.noResults.title")}</div>
      <div class="skills-no-results__desc">
        ${t("skills.noResults.desc").replace("{query}", query)}
      </div>
      <div class="skills-no-results__actions">
        <div class="skills-no-results__suggestion">
          <div class="skills-no-results__suggestion-icon">${icons.lightbulb}</div>
          <div class="skills-no-results__suggestion-content">
            <div class="skills-no-results__suggestion-title">${t("skills.noResults.suggestion.title")}</div>
            <div class="skills-no-results__suggestion-desc">${t("skills.noResults.suggestion.desc")}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderEmptyState(loading: boolean, type: "active" | "library", onTabChange?: (tab: SkillsTab) => void) {
  return html`
    <div class="skills-empty">
      <div class="skills-empty-icon">
        ${type === "active" ? icons.zap : icons.layers}
      </div>
      <div class="skills-empty-title">
        ${loading
          ? t("common.loading")
          : t("skills.noSkillsFound")}
      </div>
      <div class="skills-empty-desc">
        ${loading
          ? (type === "library" ? t("skills.market.syncing") || "正在获取技能市场数据..." : "")
          : (type === "library"
              ? t("skills.market.emptyHint") || "点击刷新按钮获取技能市场"
              : t("skills.active.emptyHint") || "暂无已激活的技能")}
      </div>
      ${!loading && type === "active" && onTabChange ? html`
        <button
          class="btn btn--sm primary"
          style="margin-top: 12px;"
          @click=${() => onTabChange("library")}
        >
          ${icons.layers} ${t("skills.tab.library") || "技能市场"}
        </button>
      ` : nothing}
    </div>
  `;
}

/** 渲染安装进度按钮 */
function renderInstallButton(skill: RemoteSkillMeta, props: SkillsProps) {
  const busy = props.busyKey === skill.name;
  const progress = props.installProgress[skill.name];
  const isConnected = props.connected;
  
  if (!busy && !progress) {
    // 未开始安装
    if (!isConnected) {
      // 未连接时显示禁用按钮和提示
      return html`
        <button
          class="btn primary skill-install-btn"
          disabled
          title="${t("skills.notConnected.tooltip")}"
        >
          ${icons.download} ${t("skills.remote.install")}
        </button>
        <span class="skill-install-hint skill-install-hint--warning">
          ${icons.alertCircle} ${t("skills.notConnected.hint")}
        </span>
      `;
    }
    return html`
      <button
        class="btn primary skill-install-btn"
        @click=${() => props.onInstallRemote(skill.name)}
      >
        ${icons.download} ${t("skills.remote.install")}
      </button>
    `;
  }
  
  // 正在安装 - 显示进度
  const percent = progress?.percent ?? 0;
  const message = progress?.message ?? (t("skills.installing") || "安装中...");
  const stage = progress?.stage ?? "downloading";
  
  return html`
    <div class="skill-install-progress">
      <div class="skill-install-progress__btn">
        <div 
          class="skill-install-progress__fill" 
          style="width: ${percent}%"
        ></div>
        <div class="skill-install-progress__content">
          ${stage === "done" 
            ? html`${icons.checkCircle}` 
            : html`${renderSpinner()}`}
          <span class="skill-install-progress__text">${message}</span>
        </div>
      </div>
      <div class="skill-install-progress__hint">
        ${stage === "downloading" ? (t("skills.install.downloading") || "请稍候，正在从云端拉取...") :
          stage === "verifying" ? (t("skills.install.verifying") || "即将完成...") :
          stage === "done" ? (t("skills.install.done") || "安装成功！") : ""}
      </div>
    </div>
  `;
}

function renderRemoteSkill(skill: RemoteSkillMeta, props: SkillsProps) {
  const busy = props.busyKey === skill.name;
  const message = props.messages[skill.name] ?? null;
  const isInstalled = (skill as RemoteSkillMeta & { installed?: boolean }).installed;
  const progress = props.installProgress[skill.name];
  // 优先使用后端返回的中文字段，否则使用翻译或美化名称
  const localizedName = skill.nameZh || getLocalizedSkillName(skill.name);
  const localizedDesc = skill.descriptionZh || getLocalizedSkillDesc(skill.name, skill.description);

  return html`
    <div class="skill-card ${busy || progress ? "skill-card--installing" : ""}">
      <!-- Icon -->
      <div class="skill-icon ${isInstalled ? "skill-icon--installed" : ""} ${busy || progress ? "skill-icon--installing" : ""}">
        ${isInstalled ? icons.checkCircle : busy || progress ? icons.loader : icons.package}
      </div>

      <!-- Content -->
      <div class="skill-content">
        <div class="skill-header">
          <span class="skill-name">${localizedName}</span>
          ${skill.version ? html`<span class="skill-version">v${skill.version}</span>` : nothing}
        </div>

        <div class="skill-desc">${clampText(localizedDesc, 160)}</div>

        <div class="skill-meta">
          ${skill.author
            ? html`<span class="skill-meta-item">${icons.user} ${skill.author}</span>`
            : nothing}
        </div>

        ${skill.tags && skill.tags.length > 0
          ? html`
              <div class="skill-tags">
                ${skill.tags.slice(0, 5).map((tag) => html`<span class="skill-tag">${getLocalizedTag(tag)}</span>`)}
                ${skill.tags.length > 5 ? html`<span class="skill-tag">+${skill.tags.length - 5}</span>` : nothing}
              </div>
            `
          : nothing}
      </div>

      <!-- Actions -->
      <div class="skill-actions">
        ${isInstalled
          ? html`
              <span class="skill-status skill-status--installed">
                ${icons.checkCircle}
                ${t("skills.remote.installed")}
              </span>
            `
          : renderInstallButton(skill, props)}

        ${message && !progress
          ? html`
              <div style="font-size: 12px; color: ${message.kind === "error" ? "var(--danger)" : "var(--ok)"};">
                ${message.message}
              </div>
            `
          : nothing}
      </div>
    </div>
  `;
}

function renderSkill(skill: SkillStatusEntry, props: SkillsProps) {
  const busy = props.busyKey === skill.skillKey;
  const apiKey = props.edits[skill.skillKey] ?? "";
  const message = props.messages[skill.skillKey] ?? null;
  const canInstall = skill.install.length > 0 && skill.missing.bins.length > 0;
  const hasMissing = skill.missing.bins.length > 0 || skill.missing.env.length > 0 || skill.missing.config.length > 0;
  const localizedName = (skill as SkillStatusEntry & { nameZh?: string }).nameZh || getLocalizedSkillName(skill.name);
  const localizedDesc = (skill as SkillStatusEntry & { descriptionZh?: string }).descriptionZh || getLocalizedSkillDesc(skill.name, skill.description);

  return html`
    <div class="skill-card">
      <!-- Icon -->
      <div class="skill-icon ${skill.activeInPrompt ? "skill-icon--installed" : ""}">
        ${skill.activeInPrompt ? icons.shieldCheck : skill.eligible ? icons.checkCircle : icons.package}
      </div>

      <!-- Content -->
      <div class="skill-content">
        <div class="skill-header">
          <span class="skill-name">${localizedName}</span>
          ${skill.pinned ? html`<span class="skill-pin-badge" title="${t("skills.pinned") || "已置顶"}">📌</span>` : nothing}
          <span class="skill-source">${skill.source}</span>
        </div>

        <div class="skill-desc">${clampText(localizedDesc, 160)}</div>

        ${hasMissing ? html`
          <div class="skill-missing-groups">
            ${skill.missing.bins.length > 0 ? html`
              <div class="skill-missing-group">
                ${icons.terminal}
                <span class="skill-missing-group__items">${skill.missing.bins.join(", ")}</span>
                <span class="skill-missing-group__hint">${canInstall ? (t("skills.diagnostic.installHint") || "点击安装") : (t("skills.diagnostic.installManual") || "需手动安装")}</span>
              </div>
            ` : nothing}
            ${skill.missing.env.length > 0 ? html`
              <div class="skill-missing-group">
                ${icons.key}
                <span class="skill-missing-group__items">${skill.missing.env.join(", ")}</span>
                <span class="skill-missing-group__hint">${skill.primaryEnv ? (t("skills.diagnostic.keyHintInline") || "填写下方密钥") : (t("skills.diagnostic.keyHintConfig") || "在设置中配置")}</span>
              </div>
            ` : nothing}
            ${skill.missing.config.length > 0 ? html`
              <div class="skill-missing-group">
                ${icons.settings}
                <span class="skill-missing-group__items">${skill.missing.config.join(", ")}</span>
                <span class="skill-missing-group__hint">${t("skills.diagnostic.configHint") || "前往设置页配置"}</span>
              </div>
            ` : nothing}
          </div>
        ` : nothing}
      </div>
      
      <!-- Actions -->
      <div class="skill-actions">
        <!-- Status Badge (four-color: active > eligible > blocked > disabled) -->
        <span class="skill-status ${
          skill.disabled ? "skill-status--disabled" :
          skill.activeInPrompt ? "skill-status--active" :
          skill.eligible ? "skill-status--eligible" : "skill-status--blocked"
        }">
          ${skill.disabled
            ? html`${icons.shieldOff} ${t("skills.disabled")}`
            : skill.activeInPrompt
              ? html`${icons.zap} ${t("skills.active") || "已激活"}`
              : skill.eligible
                ? html`${icons.shieldCheck} ${t("skills.eligible")}`
                : html`${icons.alertCircle} ${t("skills.blocked")}`}
        </span>
        
        <!-- Action Buttons -->
        <div class="row" style="gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
          <button
            class="btn btn--sm skill-pin-toggle ${skill.pinned ? "skill-pin-toggle--active" : ""}"
            ?disabled=${busy}
            @click=${() => props.onPinToggle(skill.skillKey, !skill.pinned)}
            title="${skill.pinned ? t("skills.unpin") : t("skills.pin")}"
          >
            ${skill.pinned ? "📌" : "📍"}
          </button>
          <button
            class="btn btn--sm"
            ?disabled=${busy}
            @click=${() => props.onToggle(skill.skillKey, skill.disabled)}
          >
            ${skill.disabled ? t("skills.enable") : t("skills.disable")}
          </button>
          ${canInstall
            ? html`
                <button
                  class="btn btn--sm primary"
                  ?disabled=${busy}
                  @click=${() => props.onInstall(skill.skillKey, skill.name, skill.install[0].id)}
                >
                  ${busy ? html`${renderSpinner()}` : nothing}
                  ${busy ? t("skills.installing") : translateInstallLabel(skill.install[0].label)}
                </button>
              `
            : nothing}
        </div>
        
        ${message
          ? html`
              <div style="font-size: 12px; text-align: right; color: ${message.kind === "error" ? "var(--danger)" : "var(--ok)"};">
                ${message.message}
              </div>
            `
          : nothing}
        
        <!-- API Key Input -->
        ${skill.primaryEnv
          ? html`
              <div class="skill-apikey">
                <div class="field">
                  <span>${t("skills.apiKey")}</span>
                  <input
                    type="password"
                    .value=${apiKey}
                    @input=${(e: Event) =>
                      props.onEdit(skill.skillKey, (e.target as HTMLInputElement).value)}
                    style="width: 100%;"
                  />
                </div>
                <button
                  class="btn primary btn--sm"
                  style="margin-top: 8px;"
                  ?disabled=${busy}
                  @click=${() => props.onSaveKey(skill.skillKey)}
                >
                  ${t("skills.saveKey")}
                </button>
              </div>
            `
          : nothing}
      </div>
    </div>
  `;
}
