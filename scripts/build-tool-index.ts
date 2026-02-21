/**
 * [CN-PATCH:tool-discovery] CI 构建脚本 — 出厂 FTS5 工具索引
 *
 * 读取 skills + mcp-index.json + 核心工具元数据，构建 tool-index.sqlite。
 * 出厂只含 FTS5 索引（~5MB），向量化在用户首次启动时按需执行。
 *
 * 用法：
 *   pnpm build:tool-index
 *   # 或
 *   node --experimental-strip-types scripts/build-tool-index.ts [output-dir]
 */

import { join, resolve } from "node:path";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import type { ToolIndexEntry } from "../src/config/types.tool-discovery.js";
import { openToolIndex, buildIndex, closeToolIndex, getIndexStats, ensureVectors } from "../src/dispatch/tool-index.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ROOT = resolve(import.meta.dirname ?? __dirname, "..");
const DEFAULT_OUTPUT_DIR = join(ROOT, "data");
const MCP_INDEX_FILE = "mcp-index.json"; // MCP + Extensions
const SKILLS_INDEX_FILE = "skills-availability-dictionary-enriched.json"; // Skills (已汉化)
const SKILLS_DIRS = [
  join(ROOT, "skills"),
  join(ROOT, "data", "skills"),
];

// ---------------------------------------------------------------------------
// Core Tools Metadata (固定的 30+ 核心工具)
// ---------------------------------------------------------------------------

const CORE_TOOLS: ToolIndexEntry[] = [
  { id: "core:web_search", type: "core", name: "web_search", description: "Search the web using Bing or Google", descriptionCn: "使用搜索引擎搜索网页", tags: ["search", "web", "搜索"] },
  { id: "core:web_fetch", type: "core", name: "web_fetch", description: "Fetch and process web content", descriptionCn: "抓取网页内容", tags: ["web", "fetch", "网页", "抓取"] },
  { id: "core:image_gen", type: "core", name: "image_gen", description: "Generate images using DALL-E, DashScope, or SiliconFlow", descriptionCn: "生成图片", tags: ["image", "generation", "图片", "生成"] },
  { id: "core:bash", type: "core", name: "bash", description: "Execute bash commands in terminal", descriptionCn: "执行终端命令", tags: ["bash", "shell", "terminal", "命令"] },
  { id: "core:read", type: "core", name: "read", description: "Read file contents", descriptionCn: "读取文件内容", tags: ["read", "file", "读取", "文件"] },
  { id: "core:write", type: "core", name: "write", description: "Write content to file", descriptionCn: "写入文件内容", tags: ["write", "file", "写入", "文件"] },
  { id: "core:edit", type: "core", name: "edit", description: "Edit existing file content", descriptionCn: "编辑文件内容", tags: ["edit", "file", "编辑"] },
  { id: "core:glob", type: "core", name: "glob", description: "Find files by pattern", descriptionCn: "按模式查找文件", tags: ["glob", "find", "查找", "文件"] },
  { id: "core:grep", type: "core", name: "grep", description: "Search file contents", descriptionCn: "搜索文件内容", tags: ["grep", "search", "搜索", "内容"] },
  { id: "core:browser", type: "core", name: "browser", description: "Control browser for web automation", descriptionCn: "控制浏览器", tags: ["browser", "chrome", "浏览器"] },
  { id: "core:canvas", type: "core", name: "canvas", description: "Control UI canvases", descriptionCn: "控制画布", tags: ["canvas", "ui", "画布"] },
  { id: "core:message", type: "core", name: "message", description: "Send messages and notifications", descriptionCn: "发送消息和通知", tags: ["message", "notification", "消息", "通知"] },
  { id: "core:tts", type: "core", name: "tts", description: "Text-to-speech synthesis", descriptionCn: "语音合成", tags: ["tts", "speech", "语音"] },
  { id: "core:sessions_spawn", type: "core", name: "sessions_spawn", description: "Create agent sessions", descriptionCn: "创建会话", tags: ["session", "spawn", "会话"] },
  { id: "core:desktop_control", type: "core", name: "desktop_control", description: "Control desktop GUI (click, type, screenshot)", descriptionCn: "控制桌面GUI操作", tags: ["desktop", "gui", "桌面", "控制"] },
  { id: "core:open_app", type: "core", name: "open_app", description: "Open and launch desktop applications by name", descriptionCn: "打开启动运行桌面应用程序", tags: ["open", "app", "launch", "start", "run", "打开", "启动", "运行", "应用", "程序", "软件", "微信", "WeChat", "QQ", "Chrome", "浏览器", "钉钉", "飞书"] },
  // GUI automation tools removed from distribution
];

// ---------------------------------------------------------------------------
// MCP Index Loader
// ---------------------------------------------------------------------------

function loadMcpEntries(dataDir: string): ToolIndexEntry[] {
  const filePath = join(dataDir, MCP_INDEX_FILE);
  if (!existsSync(filePath)) {
    console.warn(`[build-tool-index] MCP index not found: ${filePath}`);
    return [];
  }

  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const items: Array<Record<string, unknown>> = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.items)
        ? parsed.items
        : [];

    return items.map((item) => ({
      id: `mcp:${item.serverId ?? item.id ?? "unknown"}`,
      type: "mcp" as const,
      name: String(item.friendlyNameEn ?? item.friendlyName ?? item.serverId ?? "unknown"),
      description: String(item.descriptionEn ?? item.description ?? ""),
      descriptionCn: String(item.description ?? item.friendlyName ?? ""),
      tags: [
        ...(Array.isArray(item.tags) ? item.tags.map(String) : []),
        ...(item.category ? [String(item.category)] : []),
      ],
      metadataJson: JSON.stringify({
        npmPackage: item.npmPackage ?? undefined,
        pypiPackage: item.pypiPackage ?? undefined,
        sseUrl: item.sseUrl ?? undefined,
        category: item.category ?? undefined,
        sourceUrl: item.sourceUrl ?? undefined,
        platforms: item.platforms ?? undefined,
      }),
    }));
  } catch (err) {
    console.warn(`[build-tool-index] Failed to parse MCP index: ${err}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Skills Loader — 优先从 JSON 字典加载，fallback 到 .md 文件
// ---------------------------------------------------------------------------

function loadSkillEntries(dataDir: string): ToolIndexEntry[] {
  // 优先从 JSON 字典加载（已汉化的 2696 个 Skills）
  const jsonPath = join(dataDir, SKILLS_INDEX_FILE);
  if (existsSync(jsonPath)) {
    try {
      const raw = readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(raw);
      const skills: Array<Record<string, unknown>> = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.skills)
          ? parsed.skills
          : [];

      return skills.map((skill) => ({
        id: `skill:${skill.id ?? skill.name ?? "unknown"}`,
        type: "skill" as const,
        name: String(skill.nameEn ?? skill.name ?? "unknown"),
        description: String(skill.descriptionEn ?? skill.description ?? ""),
        descriptionCn: skill.descriptionZh ? String(skill.descriptionZh) : undefined,
        tags: [
          ...(Array.isArray(skill.tags) ? skill.tags.map(String) : []),
          ...(Array.isArray(skill.keywords) ? skill.keywords.map(String) : []),
        ],
        metadataJson: JSON.stringify({
          nameZh: skill.nameZh,
          useCases: skill.useCases,
          category: skill.category,
          availability: skill.availability,
        }),
      }));
    } catch (err) {
      console.warn(`[build-tool-index] Failed to parse Skills JSON: ${err}`);
    }
  }

  // Fallback: 从 .md 文件加载
  const entries: ToolIndexEntry[] = [];
  for (const dir of SKILLS_DIRS) {
    if (!existsSync(dir)) continue;

    try {
      const files = readdirSync(dir, { recursive: true })
        .map(String)
        .filter((f) => f.endsWith(".md") || f.endsWith(".skill.md"));

      for (const file of files) {
        try {
          const content = readFileSync(join(dir, file), "utf-8");
          const frontmatter = extractFrontmatter(content);
          if (!frontmatter.name) continue;

          entries.push({
            id: `skill:${frontmatter.name}`,
            type: "skill",
            name: frontmatter.name,
            description: frontmatter.description ?? "",
            descriptionCn: frontmatter.descriptionCn ?? undefined,
            tags: frontmatter.tags ?? [],
          });
        } catch { /* skip unreadable skill files */ }
      }
    } catch { /* skip unreadable dir */ }
  }

  return entries;
}

function extractFrontmatter(content: string): {
  name?: string;
  description?: string;
  descriptionCn?: string;
  tags?: string[];
} {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const yaml = match[1];
  const name = yaml.match(/^name:\s*(.+)/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
  const description = yaml.match(/^description:\s*(.+)/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
  const descriptionCn = yaml.match(/^description[_-]cn:\s*(.+)/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
  const tagsMatch = yaml.match(/^tags:\s*\[(.*?)\]/m);
  const tags = tagsMatch
    ? tagsMatch[1].split(",").map((t) => t.trim().replace(/^["']|["']$/g, "")).filter(Boolean)
    : undefined;

  return { name, description, descriptionCn, tags };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const outputDir = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_OUTPUT_DIR;

  console.log("[build-tool-index] Starting...");
  console.log(`  Output: ${outputDir}`);

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Collect all entries
  const coreEntries = CORE_TOOLS;
  const mcpEntries = loadMcpEntries(outputDir);
  const skillEntries = loadSkillEntries(outputDir);

  const allEntries = [...coreEntries, ...mcpEntries, ...skillEntries];

  // Deduplicate by id
  const seen = new Set<string>();
  const unique = allEntries.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  console.log(`  Core tools: ${coreEntries.length}`);
  console.log(`  MCP servers: ${mcpEntries.length}`);
  console.log(`  Skills: ${skillEntries.length}`);
  console.log(`  Total (deduplicated): ${unique.length}`);

  // Build index
  const db = openToolIndex(outputDir);
  buildIndex(db, unique);

  // Vectorize (optional - requires SiliconFlow API key)
  const embeddingApiKey = process.env.SILICONFLOW_API_KEY || process.env.EMBEDDING_API_KEY;
  if (embeddingApiKey) {
    console.log("\n  🔄 Starting vectorization...");
    console.log(`  Using model: BAAI/bge-m3 (SiliconFlow)`);

    const result = await ensureVectors(db, {
      model: "BAAI/bge-m3",
      baseUrl: "https://api.siliconflow.cn/v1",
      apiKey: embeddingApiKey,
      dimensions: 1024,
    });

    if (result.vectorized) {
      console.log(`  ✅ Vectorization complete: ${result.count} new vectors added`);
    } else if (result.error === "no_api_key") {
      console.log(`  ⚠️  Skipped vectorization: no API key`);
    } else if (result.error === "sqlite_vec_unavailable") {
      console.log(`  ⚠️  Skipped vectorization: sqlite-vec not available`);
    } else {
      console.log(`  ⚠️  Vectorization failed: ${result.error}`);
    }
  } else {
    console.log("\n  ℹ️  Skipping vectorization (no SILICONFLOW_API_KEY set)");
    console.log("     Set env var to enable hybrid search: export SILICONFLOW_API_KEY=sk-xxx");
  }

  const stats = getIndexStats(db);
  console.log(`\n  📊 Final statistics:`);
  console.log(`     Total entries: ${stats.entryCount}`);
  console.log(`     Vectorized: ${stats.vectorized ? "Yes" : "No (FTS5 only)"}`);

  closeToolIndex();
  console.log("\n[build-tool-index] Done.");
}

main().catch((err) => {
  console.error("[build-tool-index] Fatal error:", err);
  process.exit(1);
});
