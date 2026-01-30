import { html, nothing } from "lit";

import { clampText } from "../format";
import { t } from "../i18n/index.js";
import type { SkillStatusEntry, SkillStatusReport } from "../types";

export type PlaygroundCategory = {
  id: string;
  emoji: string;
  labelKey: string;
  descKey: string;
  skills: string[];
};

// 预定义的 skill 分类规则
// 按 skill 名称关键词匹配到不同分类
const SKILL_CATEGORY_RULES: Array<{ keywords: string[]; category: string }> = [
  // 效率工具
  { keywords: ["1password", "notion", "obsidian", "apple-notes", "apple-reminders", "things-mac", "bear-notes", "trello", "himalaya"], category: "productivity" },
  // 开发助手
  { keywords: ["github", "coding", "tmux", "skill-creator", "skills-troubleshoot", "mcporter"], category: "development" },
  // 创意内容
  { keywords: ["canvas", "openai-image", "nano-banana", "gifgrep", "summarize", "gemini", "oracle"], category: "creative" },
  // 生活助手
  { keywords: ["weather", "local-places", "food-order", "goplaces", "openhue", "sonoscli", "spotify", "songsee", "ordercli"], category: "lifestyle" },
  // 通讯社交
  { keywords: ["discord", "slack", "imsg", "wacli", "bluebubbles", "voice-call", "telegram"], category: "communication" },
  // 媒体工具
  { keywords: ["peekaboo", "camsnap", "video-frames", "openai-whisper", "sherpa-onnx", "nano-pdf", "bird", "blucli"], category: "media" },
  // 数据分析
  { keywords: ["model-usage", "session-logs", "blogwatcher"], category: "analytics" },
  // 系统工具
  { keywords: ["packaging", "eightctl", "sag", "gog", "clawdhub"], category: "system" },
];

// 分类定义
export const CATEGORIES: PlaygroundCategory[] = [
  {
    id: "productivity",
    emoji: "🚀",
    labelKey: "playground.category.productivity",
    descKey: "playground.category.productivityDesc",
    skills: [],
  },
  {
    id: "development",
    emoji: "💻",
    labelKey: "playground.category.development",
    descKey: "playground.category.developmentDesc",
    skills: [],
  },
  {
    id: "creative",
    emoji: "🎨",
    labelKey: "playground.category.creative",
    descKey: "playground.category.creativeDesc",
    skills: [],
  },
  {
    id: "lifestyle",
    emoji: "🌤️",
    labelKey: "playground.category.lifestyle",
    descKey: "playground.category.lifestyleDesc",
    skills: [],
  },
  {
    id: "communication",
    emoji: "💬",
    labelKey: "playground.category.communication",
    descKey: "playground.category.communicationDesc",
    skills: [],
  },
  {
    id: "media",
    emoji: "📸",
    labelKey: "playground.category.media",
    descKey: "playground.category.mediaDesc",
    skills: [],
  },
  {
    id: "analytics",
    emoji: "📊",
    labelKey: "playground.category.analytics",
    descKey: "playground.category.analyticsDesc",
    skills: [],
  },
  {
    id: "system",
    emoji: "🔧",
    labelKey: "playground.category.system",
    descKey: "playground.category.systemDesc",
    skills: [],
  },
  {
    id: "other",
    emoji: "✨",
    labelKey: "playground.category.other",
    descKey: "playground.category.otherDesc",
    skills: [],
  },
];

// 预定义的 skill 玩法示例
// 这些是小白用户可以直接复制使用的示例对话
const SKILL_EXAMPLES: Record<string, { example: string; tips?: string }> = {
  weather: {
    example: "今天北京天气怎么样？",
    tips: "可以查询任何城市的天气，支持中英文城市名",
  },
  github: {
    example: "帮我查看 clawdbot/clawdbot 这个仓库最近的 PR",
    tips: "需要先安装 gh CLI 并登录",
  },
  canvas: {
    example: "在我的 Mac 上展示一个贪吃蛇游戏",
    tips: "需要连接 Clawdbot 节点（Mac/iOS/Android）",
  },
  "1password": {
    example: "从 1Password 获取我的 GitHub token",
    tips: "需要安装 1Password CLI 并解锁",
  },
  notion: {
    example: "在我的 Notion 中创建一个新笔记",
    tips: "需要配置 Notion API key",
  },
  "apple-notes": {
    example: "帮我在备忘录里记录今天的会议要点",
    tips: "仅支持 macOS",
  },
  "apple-reminders": {
    example: "提醒我明天下午3点开会",
    tips: "仅支持 macOS",
  },
  trello: {
    example: "在我的 Trello 看板上创建一个新任务",
    tips: "需要配置 Trello API key",
  },
  obsidian: {
    example: "在 Obsidian 中搜索关于 AI 的笔记",
    tips: "需要配置 Obsidian vault 路径",
  },
  discord: {
    example: "发送一条消息到我的 Discord 服务器",
    tips: "需要配置 Discord bot token",
  },
  slack: {
    example: "在 Slack 的 #general 频道发送消息",
    tips: "需要配置 Slack bot token",
  },
  "local-places": {
    example: "帮我找附近评分高的咖啡店",
    tips: "需要配置 Google Places API",
  },
  "openai-image-gen": {
    example: "帮我生成一张可爱的猫咪图片",
    tips: "需要配置 OpenAI API key",
  },
  peekaboo: {
    example: "截取我当前屏幕的截图",
    tips: "仅支持 macOS",
  },
  camsnap: {
    example: "用摄像头拍一张照片",
    tips: "需要摄像头权限",
  },
  "spotify-player": {
    example: "播放周杰伦的歌曲",
    tips: "需要安装 spotify_player CLI",
  },
  tmux: {
    example: "列出所有 tmux 会话",
    tips: "需要安装 tmux",
  },
  summarize: {
    example: "帮我总结这篇文章的要点",
    tips: "支持网页链接和文本内容",
  },
  "model-usage": {
    example: "显示我这个月的 API 使用量统计",
  },
  "session-logs": {
    example: "查看最近的对话历史",
  },
  "video-frames": {
    example: "从这个视频中提取关键帧",
    tips: "支持常见视频格式",
  },
  "openai-whisper": {
    example: "把这段音频转换成文字",
    tips: "需要安装 whisper CLI",
  },
  gemini: {
    example: "用 Gemini 分析这张图片",
    tips: "需要配置 Gemini API key",
  },
  "food-order": {
    example: "帮我查看附近的外卖选项",
  },
  openhue: {
    example: "把客厅的灯调成暖白色",
    tips: "需要配置 Philips Hue 桥接器",
  },
  sonoscli: {
    example: "在 Sonos 音箱上播放音乐",
    tips: "需要 Sonos 设备在同一网络",
  },
  himalaya: {
    example: "检查我的邮箱有没有新邮件",
    tips: "需要配置邮箱 IMAP/SMTP",
  },
  "things-mac": {
    example: "在 Things 里添加一个待办事项",
    tips: "仅支持 macOS，需要安装 Things 3",
  },
  "bear-notes": {
    example: "在 Bear 中创建一个新笔记",
    tips: "仅支持 macOS，需要安装 Bear",
  },
  gifgrep: {
    example: "帮我找一个表示开心的 GIF",
  },
};

export type PlaygroundProps = {
  loading: boolean;
  report: SkillStatusReport | null;
  error: string | null;
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  onTrySkill: (skillName: string, example: string) => void;
  onRefresh: () => void;
};

// 根据 skill 名称判断分类
function categorizeSkill(skillName: string): string {
  const lowerName = skillName.toLowerCase();
  for (const rule of SKILL_CATEGORY_RULES) {
    for (const keyword of rule.keywords) {
      if (lowerName.includes(keyword.toLowerCase())) {
        return rule.category;
      }
    }
  }
  return "other";
}

// 将 skills 按分类整理
function organizeSkillsByCategory(skills: SkillStatusEntry[]): Map<string, SkillStatusEntry[]> {
  const result = new Map<string, SkillStatusEntry[]>();
  
  // 初始化所有分类
  for (const category of CATEGORIES) {
    result.set(category.id, []);
  }
  
  // 分配 skills 到各分类
  for (const skill of skills) {
    const categoryId = categorizeSkill(skill.name);
    const categorySkills = result.get(categoryId) || [];
    categorySkills.push(skill);
    result.set(categoryId, categorySkills);
  }
  
  return result;
}

// 获取 skill 的示例玩法
function getSkillExample(skillName: string): { example: string; tips?: string } {
  return SKILL_EXAMPLES[skillName] || {
    example: `使用 ${skillName} 技能`,
  };
}

// 渲染单个 skill 卡片
function renderSkillCard(
  skill: SkillStatusEntry,
  props: PlaygroundProps,
) {
  const example = getSkillExample(skill.name);
  const isAvailable = skill.eligible && !skill.disabled;
  const missingItems = [
    ...skill.missing.bins.map((b) => `${t("playground.missing.bin")}: ${b}`),
    ...skill.missing.env.map((e) => `${t("playground.missing.env")}: ${e}`),
    ...skill.missing.config.map((c) => `${t("playground.missing.config")}: ${c}`),
  ];

  return html`
    <div class="playground-skill-card ${isAvailable ? "" : "playground-skill-unavailable"}">
      <div class="playground-skill-header">
        <span class="playground-skill-emoji">${skill.emoji || "📦"}</span>
        <span class="playground-skill-name">${skill.name}</span>
        ${isAvailable
          ? html`<span class="playground-skill-status playground-skill-available">${t("playground.available")}</span>`
          : html`<span class="playground-skill-status playground-skill-needs-setup">${t("playground.needsSetup")}</span>`}
      </div>
      
      <p class="playground-skill-desc">${clampText(skill.description, 100)}</p>
      
      <div class="playground-skill-example">
        <div class="playground-example-label">${t("playground.tryThis")}:</div>
        <div class="playground-example-text">"${example.example}"</div>
        ${example.tips
          ? html`<div class="playground-example-tips">💡 ${example.tips}</div>`
          : nothing}
      </div>
      
      ${missingItems.length > 0
        ? html`
            <div class="playground-skill-missing">
              <div class="playground-missing-label">${t("playground.missingDeps")}:</div>
              <ul class="playground-missing-list">
                ${missingItems.slice(0, 3).map((item) => html`<li>${item}</li>`)}
                ${missingItems.length > 3
                  ? html`<li>... ${t("playground.andMore", { count: String(missingItems.length - 3) })}</li>`
                  : nothing}
              </ul>
            </div>
          `
        : nothing}
      
      <button
        class="btn playground-try-btn ${isAvailable ? "primary" : ""}"
        ?disabled=${!isAvailable}
        @click=${() => props.onTrySkill(skill.name, example.example)}
      >
        ${isAvailable ? t("playground.tryNow") : t("playground.configureFirst")}
      </button>
    </div>
  `;
}

// 渲染分类标签
function renderCategoryTab(
  category: PlaygroundCategory,
  skillCount: number,
  isActive: boolean,
  onClick: () => void,
) {
  if (skillCount === 0) return nothing;
  
  return html`
    <button
      class="playground-category-tab ${isActive ? "active" : ""}"
      @click=${onClick}
    >
      <span class="playground-category-emoji">${category.emoji}</span>
      <span class="playground-category-label">${t(category.labelKey)}</span>
      <span class="playground-category-count">${skillCount}</span>
    </button>
  `;
}

export function renderPlayground(props: PlaygroundProps) {
  const skills = props.report?.skills ?? [];
  const skillsByCategory = organizeSkillsByCategory(skills);
  
  // 计算各分类的技能数量
  const categoryCounts = new Map<string, number>();
  for (const category of CATEGORIES) {
    categoryCounts.set(category.id, skillsByCategory.get(category.id)?.length ?? 0);
  }
  
  // 获取当前激活分类的技能
  const activeCategory = props.activeCategory;
  const activeSkills = activeCategory
    ? skillsByCategory.get(activeCategory) ?? []
    : skills;
  
  // 统计可用技能数量
  const availableCount = skills.filter((s) => s.eligible && !s.disabled).length;
  const totalCount = skills.length;

  return html`
    <!-- 顶部介绍卡片 -->
    <section class="card playground-intro-card">
      <div class="playground-intro-header">
        <div class="playground-intro-icon">🎮</div>
        <div class="playground-intro-content">
          <h2 class="playground-intro-title">${t("playground.title")}</h2>
          <p class="playground-intro-desc">${t("playground.description")}</p>
        </div>
        <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
          ${props.loading ? t("common.loading") : t("common.refresh")}
        </button>
      </div>
      
      <div class="playground-stats">
        <div class="playground-stat">
          <span class="playground-stat-value">${totalCount}</span>
          <span class="playground-stat-label">${t("playground.totalSkills")}</span>
        </div>
        <div class="playground-stat">
          <span class="playground-stat-value playground-stat-available">${availableCount}</span>
          <span class="playground-stat-label">${t("playground.availableSkills")}</span>
        </div>
        <div class="playground-stat">
          <span class="playground-stat-value playground-stat-setup">${totalCount - availableCount}</span>
          <span class="playground-stat-label">${t("playground.needsSetupSkills")}</span>
        </div>
      </div>
    </section>

    ${props.error
      ? html`<div class="callout danger" style="margin-bottom: 16px;">${props.error}</div>`
      : nothing}

    <!-- 分类标签栏 -->
    <section class="card playground-categories-card">
      <div class="playground-categories">
        <button
          class="playground-category-tab ${!activeCategory ? "active" : ""}"
          @click=${() => props.onCategoryChange(null)}
        >
          <span class="playground-category-emoji">🌟</span>
          <span class="playground-category-label">${t("playground.allSkills")}</span>
          <span class="playground-category-count">${totalCount}</span>
        </button>
        ${CATEGORIES.map((category) =>
          renderCategoryTab(
            category,
            categoryCounts.get(category.id) ?? 0,
            activeCategory === category.id,
            () => props.onCategoryChange(category.id),
          ),
        )}
      </div>
      
      ${activeCategory
        ? html`
            <div class="playground-category-desc">
              ${t(CATEGORIES.find((c) => c.id === activeCategory)?.descKey ?? "")}
            </div>
          `
        : nothing}
    </section>

    <!-- 技能卡片网格 -->
    <section class="playground-skills-grid">
      ${activeSkills.length === 0
        ? html`
            <div class="playground-empty">
              <div class="playground-empty-icon">📭</div>
              <div class="playground-empty-text">${t("playground.noSkillsInCategory")}</div>
            </div>
          `
        : activeSkills.map((skill) => renderSkillCard(skill, props))}
    </section>

    <!-- 底部帮助提示 -->
    <section class="card playground-help-card">
      <details>
        <summary class="playground-help-summary">
          ${t("playground.helpTitle")}
        </summary>
        <div class="playground-help-content">
          <div class="playground-help-section">
            <h4>${t("playground.help.whatIsSkill")}</h4>
            <p>${t("playground.help.skillDesc")}</p>
          </div>
          <div class="playground-help-section">
            <h4>${t("playground.help.howToUse")}</h4>
            <p>${t("playground.help.useDesc")}</p>
          </div>
          <div class="playground-help-section">
            <h4>${t("playground.help.needsSetup")}</h4>
            <p>${t("playground.help.setupDesc")}</p>
          </div>
        </div>
      </details>
    </section>
  `;
}
