/**
 * Auto Discovery — 自动发现最匹配的 Skills/MCP/Tools
 *
 * 核心思路：
 * 1. 利用现有的 skills-index.json 和 mcp-index.json（已有 9535 个 MCP + 1200 个 Skills）
 * 2. 关键词匹配 + 描述相似度（轻量级，无需向量数据库）
 * 3. 返回 top-N 推荐，交给 AI 最终决策
 *
 * 性能目标：< 50ms（纯内存计算）
 */

import { readMarketplaceIndex } from "../mcp/marketplace-index.js";
import {
  filterWorkspaceSkillEntries,
  loadWorkspaceSkillEntries,
} from "../agents/skills/workspace.js";
import type { SkillEntry } from "../agents/skills/types.js";
import type { McpMarketplaceItem } from "../mcp/marketplace/types.js";
import type { OpenClawCNConfig } from "../config/config.js";

// ============================================================================
// 类型定义
// ============================================================================

export type AutoDiscoveryResult = {
  skillHints: string[]; // Top-N skill names
  mcpToolHints: string[]; // Top-N MCP server IDs (with wildcard)
  toolHints: string[]; // Top-N core tool names
  confidence: number; // 0-1, 整体匹配置信度
  matchDetails: string; // 调试信息
};

type ScoredItem<T> = {
  item: T;
  score: number;
  matchedTerms: string[];
};

// ============================================================================
// 关键词提取（中英文分词）
// ============================================================================

const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;
const STOP_WORDS = new Set([
  "的",
  "了",
  "是",
  "在",
  "我",
  "有",
  "和",
  "就",
  "不",
  "人",
  "都",
  "一",
  "一个",
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "should",
  "can",
  "could",
  "may",
  "might",
  "must",
  "shall",
  "帮我",
  "帮忙",
  "请",
  "能不能",
  "可以",
  "想要",
  "需要",
]);

/**
 * 从用户 prompt 中提取关键词（去除停用词）
 */
function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase();

  // 中文分词（简单版：按字符分隔，2-4 字词组合）
  const cjkTerms: string[] = [];
  const cjkChars = lower.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || [];
  if (cjkChars.length >= 2) {
    for (let i = 0; i < cjkChars.length - 1; i++) {
      cjkTerms.push(cjkChars[i] + cjkChars[i + 1]); // 2字词
      if (i < cjkChars.length - 2) {
        cjkTerms.push(cjkChars[i] + cjkChars[i + 1] + cjkChars[i + 2]); // 3字词
      }
    }
  }

  // 英文分词（按空格 + 标点分隔）
  const asciiTerms = lower
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  return [...new Set([...cjkTerms, ...asciiTerms])];
}

// ============================================================================
// 匹配评分算法
// ============================================================================

/**
 * 计算文本相似度（基于关键词重叠）
 * @returns 0-1 分数
 */
function calculateTextScore(
  keywords: string[],
  targetText: string,
  targetTags?: string[],
): { score: number; matchedTerms: string[] } {
  if (keywords.length === 0) return { score: 0, matchedTerms: [] };

  const lowerTarget = targetText.toLowerCase();
  const lowerTags = (targetTags || []).map((t) => t.toLowerCase());

  let matched = 0;
  const matchedTerms: string[] = [];

  for (const kw of keywords) {
    // 名称/描述包含关键词 → +1 分
    if (lowerTarget.includes(kw)) {
      matched++;
      matchedTerms.push(kw);
    }
    // 标签完全匹配 → +2 分（更精准）
    else if (lowerTags.includes(kw) || lowerTags.some((tag) => tag.includes(kw))) {
      matched += 2;
      matchedTerms.push(`tag:${kw}`);
    }
  }

  // 归一化：匹配数 / 关键词总数
  const score = Math.min(1.0, matched / keywords.length);
  return { score, matchedTerms };
}

// ============================================================================
// Skills 搜索
// ============================================================================

async function discoverSkills(
  prompt: string,
  config?: OpenClawCNConfig,
  topN = 5,
): Promise<ScoredItem<SkillEntry>[]> {
  const keywords = extractKeywords(prompt);
  if (keywords.length === 0) return [];

  // 加载所有 skills（利用现有的文件索引缓存，~6ms）
  const allSkills = loadWorkspaceSkillEntries(process.cwd(), { config });
  const eligible = filterWorkspaceSkillEntries(allSkills, config);

  const scored: ScoredItem<SkillEntry>[] = [];

  for (const entry of eligible) {
    const searchText = [
      entry.skill.name,
      entry.skill.description,
      entry.metadata?.emoji || "",
      ...(entry.frontmatter.tags || []),
    ].join(" ");

    const { score, matchedTerms } = calculateTextScore(
      keywords,
      searchText,
      entry.frontmatter.tags as unknown as string[] | undefined,
    );

    if (score > 0.1) {
      scored.push({ item: entry, score, matchedTerms });
    }
  }

  // 排序：分数降序
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

// ============================================================================
// MCP 搜索
// ============================================================================

async function discoverMCP(prompt: string, topN = 5): Promise<ScoredItem<McpMarketplaceItem>[]> {
  const keywords = extractKeywords(prompt);
  if (keywords.length === 0) return [];

  // 读取 MCP marketplace index（利用现有缓存，5min TTL）
  const marketplace = await readMarketplaceIndex();
  if (!marketplace || marketplace.length === 0) return [];

  const scored: ScoredItem<McpMarketplaceItem>[] = [];

  for (const item of marketplace) {
    const searchText = [
      item.friendlyName,
      item.friendlyNameCn || "",
      item.description,
      item.descriptionCn || "",
      ...(item.capabilities || []),
      ...(item.examplePrompts || []),
    ].join(" ");

    const { score, matchedTerms } = calculateTextScore(keywords, searchText, [
      ...(item.tags || []),
      ...(item.tagsCn || []),
    ]);

    // 加权：官方服务器 +10%, 高分服务器 +5%
    let weightedScore = score;
    if (item.isOfficial) weightedScore *= 1.1;
    if (item.securityScore && item.securityScore > 80) weightedScore *= 1.05;

    if (weightedScore > 0.1) {
      scored.push({ item, score: weightedScore, matchedTerms });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

// ============================================================================
// Tools 搜索（从固定的 30+ 工具中搜索）
// ============================================================================

const CORE_TOOLS_METADATA = [
  {
    name: "web_search",
    keywords: ["搜索", "查询", "查", "search", "google", "bing"],
    description: "网页搜索",
  },
  {
    name: "web_fetch",
    keywords: ["抓取", "获取", "fetch", "爬虫", "url"],
    description: "网页抓取",
  },
  {
    name: "image_gen",
    keywords: ["画图", "画", "生成图", "image", "draw", "dall-e"],
    description: "图像生成",
  },
  { name: "wechat_send", keywords: ["微信", "wechat", "发消息", "send"], description: "微信发送" },
  { name: "wechat_check", keywords: ["微信", "wechat", "未读", "check"], description: "微信检查" },
  {
    name: "desktop_control",
    keywords: ["桌面", "操作", "desktop", "gui", "click"],
    description: "桌面控制",
  },
  { name: "open_app", keywords: ["打开", "打开应用", "启动", "launch", "open"], description: "打开应用" },
  {
    name: "bash",
    keywords: ["命令", "执行", "bash", "shell", "terminal"],
    description: "命令执行",
  },
  { name: "read", keywords: ["读取", "查看", "read", "cat"], description: "读取文件" },
  { name: "write", keywords: ["写入", "创建", "write"], description: "写入文件" },
  { name: "edit", keywords: ["编辑", "修改", "edit"], description: "编辑文件" },
  { name: "glob", keywords: ["查找", "搜索文件", "glob", "find"], description: "查找文件" },
  { name: "grep", keywords: ["搜索内容", "grep"], description: "搜索内容" },
  { name: "browser", keywords: ["浏览器", "browser", "chrome"], description: "浏览器控制" },
  { name: "canvas", keywords: ["画布", "canvas", "ui"], description: "画布" },
  { name: "sessions_spawn", keywords: ["创建会话", "spawn"], description: "创建会话" },
  { name: "message", keywords: ["消息", "通知", "message"], description: "消息工具" },
  { name: "tts", keywords: ["语音", "朗读", "tts", "speak"], description: "语音合成" },
];

function discoverTools(prompt: string, topN = 3): ScoredItem<{ name: string }>[] {
  const keywords = extractKeywords(prompt);
  if (keywords.length === 0) return [];

  const lowerPrompt = prompt.toLowerCase();
  const scored: ScoredItem<{ name: string }>[] = [];

  for (const tool of CORE_TOOLS_METADATA) {
    const searchText = [tool.name, tool.description, ...tool.keywords].join(" ");
    const { score: fwdScore, matchedTerms } = calculateTextScore(keywords, searchText);

    // 反向匹配：工具关键词是否出现在 prompt 中
    let reverseMatched = 0;
    for (const kw of tool.keywords) {
      if (lowerPrompt.includes(kw.toLowerCase())) {
        reverseMatched++;
        if (!matchedTerms.includes(`rev:${kw}`)) matchedTerms.push(`rev:${kw}`);
      }
    }
    const reverseScore = tool.keywords.length > 0 ? reverseMatched / tool.keywords.length : 0;

    // 取正向和反向的最大值
    const score = Math.max(fwdScore, reverseScore);

    if (score > 0.08) {
      scored.push({ item: { name: tool.name }, score, matchedTerms });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

// ============================================================================
// 统一入口
// ============================================================================

/**
 * 自动发现最匹配的 Skills / MCP / Tools
 *
 * @param prompt 用户输入
 * @param config OpenClawCN 配置
 * @returns AutoDiscoveryResult
 */
export async function autoDiscover(
  prompt: string,
  config?: OpenClawCNConfig,
): Promise<AutoDiscoveryResult> {
  const startTime = performance.now();

  // 并行搜索三个系统
  const [skills, mcps, tools] = await Promise.all([
    discoverSkills(prompt, config, 3),
    discoverMCP(prompt, 3),
    discoverTools(prompt, 2),
  ]);

  const latencyMs = performance.now() - startTime;

  // 构建 hints
  const skillHints = skills.map((s) => s.item.skill.name);
  const mcpToolHints = mcps.map((m) => `mcp_${m.item.serverId}_*`); // 通配符匹配该 server 的所有工具
  const toolHints = tools.map((t) => t.item.name);

  // 计算整体置信度（取三者最高分的平均）
  const maxScores = [skills[0]?.score || 0, mcps[0]?.score || 0, tools[0]?.score || 0];
  const confidence = maxScores.reduce((sum, s) => sum + s, 0) / 3;

  // 调试信息
  const matchDetails = [
    `skills:[${skills.map((s) => `${s.item.skill.name}(${s.score.toFixed(2)})`).join(",")}]`,
    `mcps:[${mcps.map((m) => `${m.item.serverId}(${m.score.toFixed(2)})`).join(",")}]`,
    `tools:[${tools.map((t) => `${t.item.name}(${t.score.toFixed(2)})`).join(",")}]`,
    `latency:${latencyMs.toFixed(0)}ms`,
  ].join(" ");

  return {
    skillHints,
    mcpToolHints,
    toolHints,
    confidence,
    matchDetails,
  };
}
