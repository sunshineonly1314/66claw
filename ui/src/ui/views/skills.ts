import { html, nothing } from "lit";

import { clampText } from "../format";
import { t, tMaybe } from "../i18n/index.js";
import { icons } from "../icons.js";
import type { RemoteSkillMeta, RemoteSkillsIndex, SkillStatusEntry, SkillStatusReport, SkillsMarketResponse, MarketSkillMeta } from "../types";
import type { SkillMessageMap, SkillsTab, InstallProgress } from "../controllers/skills";

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
function beautifySkillName(name: string): string {
  return name
    .split('-')
    .map(word => {
      // 特殊缩写保持大写
      const upperWords = ['api', 'cli', 'ui', 'ai', 'id', 'url', 'http', 'https', 'ssh', 'ftp', 'sql', 'pdf', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts', 'md', 'jwt', 'oauth', 'smtp', 'imap', 'rss', 'rpc', 'sdk', 'iot', 'vpn', 'dns', 'ip'];
      if (upperWords.includes(word.toLowerCase())) {
        return word.toUpperCase();
      }
      // 普通单词首字母大写
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
// Skills 分类定义（面向用户场景）
// ============================================================================
export type SkillCategory = {
  id: string;
  emoji: string;
  labelKey: string;
  descKey: string;
};

export const SKILL_CATEGORIES: SkillCategory[] = [
  { id: "all", emoji: "✨", labelKey: "skills.category.all", descKey: "skills.category.allDesc" },
  { id: "lifestyle", emoji: "🌤️", labelKey: "skills.category.lifestyle", descKey: "skills.category.lifestyleDesc" },
  { id: "finance", emoji: "💰", labelKey: "skills.category.finance", descKey: "skills.category.financeDesc" },
  { id: "computer", emoji: "🖥️", labelKey: "skills.category.computer", descKey: "skills.category.computerDesc" },
  { id: "productivity", emoji: "🚀", labelKey: "skills.category.productivity", descKey: "skills.category.productivityDesc" },
  { id: "creative", emoji: "🎨", labelKey: "skills.category.creative", descKey: "skills.category.creativeDesc" },
  { id: "communication", emoji: "💬", labelKey: "skills.category.communication", descKey: "skills.category.communicationDesc" },
  { id: "development", emoji: "💻", labelKey: "skills.category.development", descKey: "skills.category.developmentDesc" },
];

// ============================================================================
// 语义关键词索引（用于智能搜索）
// 每个分类包含关键词和同义词，支持用户用自然语言搜索
// ============================================================================
const SKILL_SEMANTIC_INDEX: Record<string, { keywords: string[]; synonyms: string[] }> = {
  // 生活助手
  lifestyle: {
    keywords: ["weather", "local-places", "food-order", "goplaces", "openhue", "sonoscli", "spotify", "songsee", "ordercli", "music"],
    synonyms: ["天气", "外卖", "点餐", "美食", "地图", "导航", "附近", "餐厅", "咖啡", "音乐", "播放", "灯光", "智能家居", "家居", "生活", "日常"],
  },
  // 财经理财
  finance: {
    keywords: ["stock", "finance", "budget", "accounting", "investment", "crypto", "banking"],
    synonyms: ["股票", "炒股", "行情", "涨跌", "A股", "港股", "美股", "基金", "理财", "记账", "账本", "投资", "财务", "银行", "存款", "贷款", "金融"],
  },
  // 电脑控制
  computer: {
    keywords: ["peekaboo", "camsnap", "screenshot", "file", "folder", "system", "terminal", "shell", "tmux"],
    synonyms: ["截图", "屏幕", "摄像头", "拍照", "文件", "文件夹", "系统", "终端", "命令行", "电脑", "控制", "操作", "桌面", "窗口"],
  },
  // 效率工具
  productivity: {
    keywords: ["1password", "notion", "obsidian", "apple-notes", "apple-reminders", "things-mac", "bear-notes", "trello", "himalaya", "calendar", "todo", "task"],
    synonyms: ["笔记", "备忘录", "提醒", "日历", "待办", "任务", "密码", "效率", "办公", "工作", "日程", "安排", "计划", "邮件", "邮箱"],
  },
  // 创意内容
  creative: {
    keywords: ["canvas", "openai-image", "nano-banana", "gifgrep", "summarize", "gemini", "oracle", "image", "video", "draw"],
    synonyms: ["图片", "图像", "生成", "画图", "绘画", "创作", "设计", "视频", "GIF", "动图", "总结", "摘要", "创意", "艺术"],
  },
  // 通讯社交
  communication: {
    keywords: ["discord", "slack", "imsg", "wacli", "bluebubbles", "voice-call", "telegram", "wechat", "message", "chat"],
    synonyms: ["微信", "消息", "聊天", "发送", "通讯", "社交", "联系", "沟通", "群组", "频道", "语音", "通话"],
  },
  // 开发工具
  development: {
    keywords: ["github", "coding", "tmux", "skill-creator", "skills-troubleshoot", "mcporter", "code", "git", "npm", "api"],
    synonyms: ["代码", "编程", "开发", "GitHub", "仓库", "PR", "调试", "测试", "部署", "发布", "API", "接口"],
  },
};

// 根据 skill 名称判断分类
function categorizeSkill(skillName: string): string {
  const lowerName = skillName.toLowerCase();
  for (const [category, { keywords }] of Object.entries(SKILL_SEMANTIC_INDEX)) {
    for (const keyword of keywords) {
      if (lowerName.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }
  return "other";
}

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
  for (const [category, { synonyms }] of Object.entries(SKILL_SEMANTIC_INDEX)) {
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

    // 如果匹配到分类，返回该分类下的所有 skills
    if (matchedCategory) {
      const skillCategory = categorizeSkill(skill.name);
      return skillCategory === matchedCategory;
    }

    // 检查同义词匹配
    for (const { keywords, synonyms } of Object.values(SKILL_SEMANTIC_INDEX)) {
      const allTerms = [...keywords, ...synonyms];
      for (const term of allTerms) {
        if (term.toLowerCase().includes(lowerQuery) || lowerQuery.includes(term.toLowerCase())) {
          // 检查这个 skill 是否属于这个分类
          for (const keyword of keywords) {
            if (skill.name.toLowerCase().includes(keyword.toLowerCase())) {
              return true;
            }
          }
        }
      }
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
  onFilterChange: (next: string) => void;
  onRefresh: () => void;
  onToggle: (skillKey: string, enabled: boolean) => void;
  onEdit: (skillKey: string, value: string) => void;
  onSaveKey: (skillKey: string) => void;
  onInstall: (skillKey: string, name: string, installId: string) => void;
  onTabChange: (tab: SkillsTab) => void;
  onRefreshRemote: () => void;
  onInstallRemote: (skillName: string) => void;
  onCategoryChange: (category: string) => void;
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
  if (diffMin < 60) return `${diffMin} ${t("skills.time.minutesAgo") || "分钟前"}`;
  if (diffHour < 24) return `${diffHour} ${t("skills.time.hoursAgo") || "小时前"}`;
  return `${diffDay} ${t("skills.time.daysAgo") || "天前"}`;
}

// ============================================================================
// ClawdbotCN 专属：小白用户诊断卡片
// ============================================================================

/**
 * 分析技能状态，生成诊断摘要
 */
function analyzeDiagnostics(skills: SkillStatusEntry[]): {
  eligible: number;
  blocked: number;
  disabled: number;
  missingBins: string[];
  missingEnvs: string[];
  missingConfigs: string[];
  hasIssues: boolean;
} {
  let eligible = 0;
  let blocked = 0;
  let disabled = 0;
  const missingBins = new Set<string>();
  const missingEnvs = new Set<string>();
  const missingConfigs = new Set<string>();
  
  for (const skill of skills) {
    if (skill.eligible) {
      eligible++;
    } else if (skill.disabled) {
      disabled++;
    } else {
      blocked++;
      // 收集缺失的依赖
      if (skill.missing?.bins) {
        for (const bin of skill.missing.bins) {
          missingBins.add(bin);
        }
      }
      if (skill.missing?.env) {
        for (const env of skill.missing.env) {
          missingEnvs.add(env);
        }
      }
      if (skill.missing?.config) {
        for (const cfg of skill.missing.config) {
          missingConfigs.add(cfg);
        }
      }
    }
  }
  
  return {
    eligible,
    blocked,
    disabled,
    missingBins: Array.from(missingBins).slice(0, 5), // 最多显示5个
    missingEnvs: Array.from(missingEnvs).slice(0, 5),
    missingConfigs: Array.from(missingConfigs).slice(0, 5),
    hasIssues: blocked > 0 || missingBins.size > 0 || missingEnvs.size > 0 || missingConfigs.size > 0,
  };
}

/**
 * 渲染诊断状态卡片
 * 让小白用户一眼看懂技能状态和问题所在
 */
function renderDiagnosticCard(skills: SkillStatusEntry[], props: SkillsProps) {
  if (props.loading || skills.length === 0) {
    return nothing;
  }
  
  const diag = analyzeDiagnostics(skills);
  
  // 如果一切正常，显示简洁的成功状态
  if (!diag.hasIssues) {
    return html`
      <section class="card diagnostic-card diagnostic-card--ok">
        <div class="diagnostic-card__header">
          <span class="diagnostic-card__icon diagnostic-card__icon--ok">${icons.shieldCheck}</span>
          <div class="diagnostic-card__title">
            ${t("skills.diagnostic.allGood") || "✅ 技能状态良好"}
          </div>
        </div>
        <div class="diagnostic-card__stats">
          <div class="diagnostic-stat diagnostic-stat--eligible">
            <span class="diagnostic-stat__value">${diag.eligible}</span>
            <span class="diagnostic-stat__label">${t("skills.diagnostic.eligible") || "可用"}</span>
          </div>
          ${diag.disabled > 0 ? html`
            <div class="diagnostic-stat diagnostic-stat--disabled">
              <span class="diagnostic-stat__value">${diag.disabled}</span>
              <span class="diagnostic-stat__label">${t("skills.diagnostic.disabled") || "已禁用"}</span>
            </div>
          ` : nothing}
        </div>
      </section>
    `;
  }
  
  // 有问题时，显示详细诊断信息
  return html`
    <section class="card diagnostic-card diagnostic-card--warning">
      <div class="diagnostic-card__header">
        <span class="diagnostic-card__icon diagnostic-card__icon--warning">${icons.alertTriangle}</span>
        <div class="diagnostic-card__title">
          ${t("skills.diagnostic.issuesFound") || "⚠️ 发现一些问题"}
        </div>
        <button 
          class="btn btn--sm btn--ghost"
          @click=${props.onRefresh}
          title="${t("skills.diagnostic.refresh") || "重新检查"}"
        >
          ${icons.refreshCw}
        </button>
      </div>
      
      <div class="diagnostic-card__stats">
        <div class="diagnostic-stat diagnostic-stat--eligible">
          <span class="diagnostic-stat__value">${diag.eligible}</span>
          <span class="diagnostic-stat__label">${t("skills.diagnostic.eligible") || "可用"}</span>
        </div>
        <div class="diagnostic-stat diagnostic-stat--blocked">
          <span class="diagnostic-stat__value">${diag.blocked}</span>
          <span class="diagnostic-stat__label">${t("skills.diagnostic.blocked") || "缺依赖"}</span>
        </div>
        ${diag.disabled > 0 ? html`
          <div class="diagnostic-stat diagnostic-stat--disabled">
            <span class="diagnostic-stat__value">${diag.disabled}</span>
            <span class="diagnostic-stat__label">${t("skills.diagnostic.disabled") || "已禁用"}</span>
          </div>
        ` : nothing}
      </div>
      
      ${diag.missingBins.length > 0 ? html`
        <div class="diagnostic-card__issue">
          <div class="diagnostic-issue__title">
            ${icons.terminal}
            <span>${t("skills.diagnostic.missingTools") || "缺少命令行工具"}</span>
          </div>
          <div class="diagnostic-issue__items">
            ${diag.missingBins.map(bin => html`<code class="diagnostic-issue__item">${bin}</code>`)}
          </div>
          <div class="diagnostic-issue__hint">
            💡 ${t("skills.diagnostic.installHint") || "点击技能卡片上的「安装」按钮可自动安装"}
          </div>
        </div>
      ` : nothing}
      
      ${diag.missingEnvs.length > 0 ? html`
        <div class="diagnostic-card__issue">
          <div class="diagnostic-issue__title">
            ${icons.key}
            <span>${t("skills.diagnostic.missingKeys") || "缺少 API 密钥"}</span>
          </div>
          <div class="diagnostic-issue__items">
            ${diag.missingEnvs.map(env => html`<code class="diagnostic-issue__item">${env}</code>`)}
          </div>
          <div class="diagnostic-issue__hint">
            💡 ${t("skills.diagnostic.keyHint") || "在技能卡片中填写 API 密钥并点击保存"}
          </div>
        </div>
      ` : nothing}
      
      ${diag.missingConfigs.length > 0 ? html`
        <div class="diagnostic-card__issue">
          <div class="diagnostic-issue__title">
            ${icons.settings}
            <span>${t("skills.diagnostic.missingConfig") || "缺少配置项"}</span>
          </div>
          <div class="diagnostic-issue__items">
            ${diag.missingConfigs.map(cfg => html`<code class="diagnostic-issue__item">${cfg}</code>`)}
          </div>
          <div class="diagnostic-issue__hint">
            💡 ${t("skills.diagnostic.configHint") || "请在「设置」页面配置相关选项"}
          </div>
        </div>
      ` : nothing}
    </section>
  `;
}

// Loading Spinner Component
function renderSpinner() {
  return html`<span class="skill-spinner">${icons.loader}</span>`;
}

export function renderSkills(props: SkillsProps) {
  const allSkills = props.report?.skills ?? [];
  const filter = props.filter.trim();
  const activeCategory = props.activeCategory || "all";
  
  // 优先使用新的市场数据，兼容旧的 remoteIndex
  const allMarketSkills = props.marketResponse?.skills ?? props.remoteIndex?.skills ?? [];
  
  // 过滤掉隐藏的技能（ClawdbotCN：过滤国内不可用或已废弃的技能）
  const skills = allSkills.filter(s => !isSkillHidden(s.name));
  const marketSkills = allMarketSkills.filter(s => !isSkillHidden(s.name));
  
  // 智能搜索 + 分类过滤
  const { matched: searchMatchedLocal } = smartSearchSkills(
    skills.map(s => ({ ...s, tags: [] as string[] })),
    filter,
  );
  
  const { matched: searchMatchedMarket, category: detectedCategory } = smartSearchSkills(
    marketSkills,
    filter,
  );

  // 应用分类过滤
  const filtered = activeCategory === "all" 
    ? searchMatchedLocal 
    : searchMatchedLocal.filter(skill => categorizeSkill(skill.name) === activeCategory);
  
  const filteredMarketUnsorted = activeCategory === "all"
    ? searchMatchedMarket
    : searchMatchedMarket.filter(skill => categorizeSkill(skill.name) === activeCategory);
  
  // 排序：兼容当前平台的技能排前面，不兼容的排后面
  const filteredMarket = [...filteredMarketUnsorted].sort((a, b) => {
    const aCompatible = checkPlatformCompatibility(a.name).compatible;
    const bCompatible = checkPlatformCompatibility(b.name).compatible;
    if (aCompatible && !bCompatible) return -1;
    if (!aCompatible && bCompatible) return 1;
    return 0;
  });
  
  // 同步状态
  const isSyncing = props.marketSyncing || props.marketLoading;
  const lastSyncedAt = props.marketLastSyncedAt ?? props.remoteIndex?.updated ?? null;

  // 检查是否有搜索结果
  const hasResults = props.activeTab === "local" ? filtered.length > 0 : filteredMarket.length > 0;
  const showNoResultsHint = filter.trim() && !hasResults;

  return html`
    <!-- 智能搜索引导区 -->
    <section class="card skills-search-hero">
      <div class="skills-search-hero__content">
        <div class="skills-search-hero__title">${t("skills.search.title")}</div>
        <div class="skills-search-hero__subtitle">${t("skills.search.subtitle")}</div>
        
        <!-- 智能搜索框 -->
        <div class="skills-smart-search">
          <div class="skills-smart-search__icon">${icons.search}</div>
          <!-- 隐藏的 honeypot 字段欺骗浏览器自动填充 -->
          <input type="text" style="display:none" name="fakeusernameremembered" />
          <input type="password" style="display:none" name="fakepasswordremembered" />
          <input
            type="text"
            class="skills-smart-search__input"
            .value=${props.filter}
            @input=${(e: Event) => {
              const input = e.target as HTMLInputElement;
              props.onFilterChange(input.value);
            }}
            @focus=${(e: Event) => {
              // 防止浏览器自动填充：焦点时检查值是否与状态一致
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

        <!-- 搜索提示 -->
        ${detectedCategory && filter ? html`
          <div class="skills-search-hint">
            ${icons.lightbulb}
            <span>${t("skills.search.detected")}: </span>
            <button 
              class="skills-search-hint__link"
              @click=${() => {
                props.onCategoryChange(detectedCategory);
                props.onFilterChange("");
              }}
            >
              ${t(`skills.category.${detectedCategory}`)}
            </button>
          </div>
        ` : nothing}
      </div>
    </section>

    <!-- 分类导航 -->
    <section class="skills-categories">
      <div class="skills-categories__header">
        <span class="skills-categories__label">${t("skills.category.label")}</span>
      </div>
      <div class="skills-categories__list">
        ${SKILL_CATEGORIES.map(cat => html`
          <button
            class="skills-category-chip ${activeCategory === cat.id ? "skills-category-chip--active" : ""}"
            @click=${() => props.onCategoryChange(cat.id)}
            title="${t(cat.descKey)}"
          >
            <span class="skills-category-chip__emoji">${cat.emoji}</span>
            <span class="skills-category-chip__label">${t(cat.labelKey)}</span>
            ${activeCategory === cat.id ? html`
              <span class="skills-category-chip__count">
                ${props.activeTab === "local" ? filtered.length : filteredMarket.length}
              </span>
            ` : nothing}
          </button>
        `)}
      </div>
    </section>

    <!-- 帮助说明卡片 -->
    <section class="card help-card">
      <details>
        <summary class="help-card__summary">
          ${t("skills.help.title")}
        </summary>
        <div class="help-card__content">
          <p class="help-card__text">${t("skills.help.description")}</p>
          
          <div class="help-card__section">
            <strong>${t("skills.help.howToInstall")}</strong>
            <p class="help-card__text" style="white-space: pre-line;">${t("skills.help.installSteps")}</p>
          </div>
          
          <div class="help-card__section">
            <strong>${t("skills.help.apiKeyTip")}</strong>
            <p class="help-card__text">${t("skills.help.apiKeyDesc")}</p>
          </div>
          
          <div class="help-card__section">
            <strong>${t("skills.help.statusExplain")}</strong>
            <ul class="help-card__list">
              <li>
                <span class="skill-status skill-status--eligible" style="margin-right: 8px;">
                  ${icons.shieldCheck}
                  ${t("skills.eligible")}
                </span>
                ${t("skills.help.eligibleDesc")}
              </li>
              <li>
                <span class="skill-status skill-status--blocked" style="margin-right: 8px;">
                  ${icons.alertCircle}
                  ${t("skills.blocked")}
                </span>
                ${t("skills.help.blockedDesc")}
              </li>
              <li>
                <span class="skill-status skill-status--disabled" style="margin-right: 8px;">
                  ${icons.shieldOff}
                  ${t("skills.disabled")}
                </span>
                ${t("skills.help.disabledDesc")}
              </li>
            </ul>
          </div>
        </div>
      </details>
    </section>

    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="card-title">${t("skills.cardTitle")}</div>
          <div class="card-sub">${t("skills.cardSub")}</div>
        </div>
        <button 
          class="btn" 
          ?disabled=${props.loading || props.remoteLoading || isSyncing} 
          @click=${props.activeTab === "local" ? props.onRefresh : props.onRefreshRemote}
        >
          ${(props.activeTab === "local" ? props.loading : (props.remoteLoading || isSyncing)) 
            ? html`${renderSpinner()} ${t("common.loading")}` 
            : html`${icons.refreshCw} ${t("common.refresh")}`}
        </button>
      </div>

      <!-- Tab switcher - Modern Style -->
      <div class="skills-tabs" style="margin-top: 16px;">
        <button 
          class="skills-tab ${props.activeTab === "local" ? "skills-tab--active" : ""}"
          @click=${() => props.onTabChange("local")}
        >
          ${icons.hardDrive}
          <span>${t("skills.tab.local")}</span>
          <span class="skills-tab-count">${skills.length}</span>
        </button>
        <button 
          class="skills-tab ${props.activeTab === "remote" ? "skills-tab--active" : ""}"
          @click=${() => props.onTabChange("remote")}
        >
          ${icons.cloudDownload}
          <span>${t("skills.tab.remote")}</span>
          <span class="skills-tab-count">${marketSkills.length}</span>
          ${isSyncing ? renderSpinner() : nothing}
        </button>
      </div>

      <!-- 结果计数 -->
      <div class="skills-results-bar" style="margin-top: 14px;">
        <div class="skills-results-count">
          ${props.activeTab === "local" ? filtered.length : filteredMarket.length} ${t("skills.shown")}
          ${filter ? html`<span class="muted"> · "${filter}"</span>` : nothing}
          ${activeCategory !== "all" ? html`<span class="muted"> · ${t(`skills.category.${activeCategory}`)}</span>` : nothing}
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

      ${props.activeTab === "local" ? html`
        ${props.error
          ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`
          : nothing}

        ${filtered.length === 0
          ? showNoResultsHint 
            ? renderNoResultsHint(filter, props)
            : renderEmptyState(props.loading, "local")
          : html`
              <div class="skills-list" style="margin-top: 16px;">
                ${filtered.map((skill) => renderSkill(skill as SkillStatusEntry, props))}
              </div>
            `}
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

        ${filteredMarket.length === 0
          ? showNoResultsHint 
            ? renderNoResultsHint(filter, props)
            : renderEmptyState(isSyncing, "remote")
          : html`
              <div class="skills-list" style="margin-top: 16px;">
                ${filteredMarket.map((skill) => renderRemoteSkill(skill, props))}
              </div>
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

function renderEmptyState(loading: boolean, type: "local" | "remote") {
  return html`
    <div class="skills-empty">
      <div class="skills-empty-icon">
        ${type === "local" ? icons.layers : icons.cloudDownload}
      </div>
      <div class="skills-empty-title">
        ${loading 
          ? t("common.loading")
          : t("skills.noSkillsFound")}
      </div>
      <div class="skills-empty-desc">
        ${loading 
          ? (type === "remote" ? t("skills.market.syncing") || "正在获取技能市场数据..." : "")
          : (type === "remote" 
              ? t("skills.market.emptyHint") || "点击刷新按钮获取技能市场" 
              : t("skills.local.emptyHint") || "暂无已安装的技能")}
      </div>
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
  const message = progress?.message ?? "安装中...";
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
        ${stage === "downloading" ? "请稍候，正在从云端拉取..." : 
          stage === "verifying" ? "即将完成..." : 
          stage === "done" ? "安装成功！" : ""}
      </div>
    </div>
  `;
}

function renderRemoteSkill(skill: RemoteSkillMeta, props: SkillsProps) {
  const busy = props.busyKey === skill.name;
  const message = props.messages[skill.name] ?? null;
  const isInstalled = (skill as RemoteSkillMeta & { installed?: boolean }).installed;
  const progress = props.installProgress[skill.name];
  // 检测平台兼容性
  const { compatible, requiredPlatform } = checkPlatformCompatibility(skill.name);
  // 优先使用后端返回的中文字段，否则使用翻译或美化名称
  const localizedName = skill.nameZh || getLocalizedSkillName(skill.name);
  const localizedDesc = skill.descriptionZh || getLocalizedSkillDesc(skill.name, skill.description);
  
  return html`
    <div class="skill-card ${!compatible ? "skill-card--incompatible" : ""} ${busy || progress ? "skill-card--installing" : ""}">
      <!-- Icon -->
      <div class="skill-icon ${isInstalled ? "skill-icon--installed" : ""} ${!compatible ? "skill-icon--incompatible" : ""} ${busy || progress ? "skill-icon--installing" : ""}">
        ${isInstalled ? icons.checkCircle : busy || progress ? icons.loader : icons.package}
      </div>
      
      <!-- Content -->
      <div class="skill-content">
        <div class="skill-header">
          <span class="skill-name">${localizedName}</span>
          ${skill.version ? html`<span class="skill-version">v${skill.version}</span>` : nothing}
          ${!compatible ? html`<span class="skill-platform-badge">${requiredPlatform}</span>` : nothing}
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
        ${!compatible
          ? html`
              <span class="skill-status skill-status--incompatible">
                ${icons.alertCircle}
                ${t("skills.incompatible") || `仅支持 ${requiredPlatform}`}
              </span>
            `
          : isInstalled
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
  const hasMissing = skill.missing.bins.length > 0 || skill.missing.env.length > 0 || skill.missing.config.length > 0 || skill.missing.os.length > 0;
  const localizedName = (skill as any).nameZh || getLocalizedSkillName(skill.name);
  const localizedDesc = (skill as any).descriptionZh || getLocalizedSkillDesc(skill.name, skill.description);

  return html`
    <div class="skill-card">
      <!-- Icon -->
      <div class="skill-icon ${skill.eligible ? "skill-icon--installed" : ""}">
        ${skill.eligible ? icons.shieldCheck : icons.package}
      </div>

      <!-- Content -->
      <div class="skill-content">
        <div class="skill-header">
          <span class="skill-name">${localizedName}</span>
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
            ${skill.missing.os.length > 0 ? html`
              <div class="skill-missing-group">
                ${icons.alertCircle}
                <span class="skill-missing-group__items">${t("skills.diagnostic.osRequired") || "需要"} ${skill.missing.os.join("/")}</span>
              </div>
            ` : nothing}
          </div>
        ` : nothing}
      </div>
      
      <!-- Actions -->
      <div class="skill-actions">
        <!-- Status Badge -->
        <span class="skill-status ${
          skill.disabled ? "skill-status--disabled" : 
          skill.eligible ? "skill-status--eligible" : "skill-status--blocked"
        }">
          ${skill.disabled 
            ? html`${icons.shieldOff} ${t("skills.disabled")}` 
            : skill.eligible 
              ? html`${icons.shieldCheck} ${t("skills.eligible")}` 
              : html`${icons.alertCircle} ${t("skills.blocked")}`}
        </span>
        
        <!-- Action Buttons -->
        <div class="row" style="gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
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
