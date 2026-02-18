/**
 * [CN-PATCH:tool-discovery] 智能工具发现模块
 *
 * 替代 auto-discovery.ts 的搜索逻辑：
 *   - 基于 tool-index.sqlite（FTS5 BM25 + sqlite-vec 向量混合搜索）
 *   - 从 12k+ 工具中 <10ms 选出 ≤50 个
 *   - 分桶：已安装 skill/core → hints，可安装 MCP → mcpSuggestions
 *   - 生成 toolSummaryPrompt 注入 system prompt
 *
 * 隔离原则：
 *   - 不修改 auto-discovery.ts（旧版保留做 fallback）
 *   - engine.ts 条件分支选择走新版或旧版
 */

import { join, resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { DatabaseSync } from "node:sqlite";
import type {
  ToolDiscoveryConfig,
  ToolDiscoveryResult,
  ToolSearchResult,
  McpSuggestion,
} from "../config/types.tool-discovery.js";
import { hybridSearch, openToolIndex, getIndexStats } from "./tool-index.js";

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_MAX_RESULTS = 50;
const DEFAULT_MIN_SCORE = 0.1;

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * 智能工具发现。
 *
 * 调用 tool-index 的混合搜索，将结果分桶为 skillHints / mcpToolHints / toolHints，
 * 并生成 toolSummaryPrompt（给 LLM 的结构化摘要文本）。
 *
 * @param prompt 用户输入
 * @param config ToolDiscoveryConfig
 * @param dataDir tool-index.sqlite 所在目录（可选，默认从环境变量推导）
 * @returns ToolDiscoveryResult
 */
export async function discoverTools(
  prompt: string,
  config?: ToolDiscoveryConfig,
  dataDir?: string,
): Promise<ToolDiscoveryResult> {
  const startTime = performance.now();

  // 空结果模板
  const emptyResult: ToolDiscoveryResult = {
    skillHints: [],
    mcpToolHints: [],
    toolHints: [],
    mcpSuggestions: [],
    toolSummaryPrompt: "",
    confidence: 0,
    searchLatencyMs: 0,
  };

  // 未启用或无 prompt → 返回空
  // FIX: 添加调试日志
  if (config?.enabled === false) {
    console.debug("[tool-discovery] Disabled by config");
    return emptyResult;
  }

  if (!prompt || prompt.trim().length < 2) {
    console.debug("[tool-discovery] Query too short", { prompt });
    return emptyResult;
  }

  // 打开 DB（利用 openToolIndex 的 singleton 缓存）
  let db: DatabaseSync;
  try {
    const dir = dataDir ?? resolveDataDir();
    if (!dir) {
      // FIX: 记录环境变量状态以便调试
      console.warn("[tool-discovery] Cannot resolve data dir", {
        env: {
          OPENCLAWCN_DATA_DIR: process.env.OPENCLAWCN_DATA_DIR,
          OPENCLAWCN_STATE_DIR: process.env.OPENCLAWCN_STATE_DIR,
          HOME: process.env.HOME,
          USERPROFILE: process.env.USERPROFILE,
        },
      });
      return emptyResult;
    }
    db = openToolIndex(dir);
  } catch (err) {
    // FIX: 记录错误详情
    console.error("[tool-discovery] Failed to open tool index", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return emptyResult;
  }

  // 检查索引是否有数据
  const stats = getIndexStats(db);
  if (stats.entryCount === 0) {
    console.warn("[tool-discovery] Index is empty", stats);
    return emptyResult;
  }

  // 执行混合搜索
  const maxResults = config?.search?.maxResults ?? DEFAULT_MAX_RESULTS;
  const minScore = config?.search?.minScore ?? DEFAULT_MIN_SCORE;

  let results: ToolSearchResult[];
  try {
    results = await hybridSearch(db, prompt, {
      maxResults,
      minScore,
      hybridWeight: config?.search?.hybridWeight
        ? { fts: config.search.hybridWeight.fts, vector: config.search.hybridWeight.vector }
        : undefined,
    });
  } catch (err) {
    // FIX: 记录搜索失败
    console.error("[tool-discovery] Search failed", {
      error: err instanceof Error ? err.message : String(err),
      prompt,
      config,
    });
    return emptyResult;
  }

  const searchLatencyMs = performance.now() - startTime;

  if (results.length === 0) {
    console.debug("[tool-discovery] No results found", { prompt, searchLatencyMs });
    return { ...emptyResult, searchLatencyMs };
  }

  // FIX: 记录成功搜索
  console.debug("[tool-discovery] Search complete", {
    prompt,
    resultCount: results.length,
    searchLatencyMs,
  });

  // 分桶
  const skillHints: string[] = [];
  const mcpToolHints: string[] = [];
  const toolHints: string[] = [];
  const mcpSuggestions: McpSuggestion[] = [];

  for (const r of results) {
    const { entry, score } = r;
    switch (entry.type) {
      case "skill":
        skillHints.push(entry.name);
        break;
      case "mcp": {
        // MCP server ID → wildcard 格式 mcp_{serverId}_*
        mcpToolHints.push(`mcp_${entry.id.replace(/^mcp:/, "")}_*`);
        // 构建 McpSuggestion
        const meta = parseMetadata(entry.metadataJson);
        mcpSuggestions.push({
          serverId: entry.id.replace(/^mcp:/, ""),
          friendlyName: entry.name,
          description: entry.descriptionCn ?? entry.description,
          npmPackage: meta?.npmPackage,
          sseUrl: meta?.sseUrl,
          score,
        });
        break;
      }
      case "core":
        toolHints.push(entry.name);
        break;
    }
  }

  // 计算整体置信度（top-3 平均分）
  const top3Scores = results.slice(0, 3).map((r) => r.score);
  const confidence = top3Scores.reduce((sum, s) => sum + s, 0) / Math.max(top3Scores.length, 1);

  // 生成 toolSummaryPrompt
  const toolSummaryPrompt = buildToolSummaryPrompt(results);

  return {
    skillHints,
    mcpToolHints,
    toolHints,
    mcpSuggestions,
    toolSummaryPrompt,
    confidence,
    searchLatencyMs,
    rawResults: results,
  };
}

// ---------------------------------------------------------------------------
// Tool Summary Prompt Builder
// ---------------------------------------------------------------------------

/**
 * 构建注入 system prompt 的工具摘要文本。
 * 格式紧凑，给 LLM 足够上下文做最终工具选择。
 */
function buildToolSummaryPrompt(results: ToolSearchResult[]): string {
  if (results.length === 0) return "";

  const lines: string[] = [];
  lines.push("## Available Tools (auto-discovered, ranked by relevance)\n");

  // 按类型分组
  const skills = results.filter((r) => r.entry.type === "skill");
  const mcps = results.filter((r) => r.entry.type === "mcp");
  const cores = results.filter((r) => r.entry.type === "core");

  if (skills.length > 0) {
    lines.push("### Skills");
    for (const r of skills.slice(0, 10)) {
      const desc = r.entry.descriptionCn ?? r.entry.description;
      lines.push(`- **${r.entry.name}**: ${desc}`);
    }
    if (skills.length > 10) {
      lines.push(`- _...and ${skills.length - 10} more skills_`);
    }
    lines.push("");
  }

  if (mcps.length > 0) {
    lines.push("### MCP Servers");
    for (const r of mcps.slice(0, 15)) {
      const desc = r.entry.descriptionCn ?? r.entry.description;
      const meta = parseMetadata(r.entry.metadataJson);
      const installHint = meta?.npmPackage ? ` (npm: ${meta.npmPackage})` : "";
      lines.push(`- **${r.entry.name}**: ${desc}${installHint}`);
    }
    if (mcps.length > 15) {
      lines.push(`- _...and ${mcps.length - 15} more MCP servers_`);
    }
    lines.push("");
  }

  if (cores.length > 0) {
    lines.push("### Core Tools");
    for (const r of cores) {
      const desc = r.entry.descriptionCn ?? r.entry.description;
      lines.push(`- **${r.entry.name}**: ${desc}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseMetadata(json?: string): Record<string, string> | undefined {
  if (!json || json === "{}") return undefined;
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

/**
 * 推导 tool-index.sqlite 所在目录。
 *
 * 优先级：
 *   1. 环境变量 OPENCLAWCN_DATA_DIR（显式指定）
 *   2. 项目内 data/（CI build-tool-index.ts 的默认输出 — 打包分发场景）
 *   3. 标准 STATE_DIR（复用项目已有的路径解析 ~/.openclawcn）
 */
function resolveDataDir(): string | undefined {
  // 1. 显式环境变量
  const explicit = process.env.OPENCLAWCN_DATA_DIR?.trim();
  if (explicit) return explicit;

  // 2. 项目内 data/（CI 构建脚本的输出路径，分发包内自带索引）
  try {
    const thisDir =
      typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
    const projectData = resolve(thisDir, "..", "..", "data");
    if (existsSync(join(projectData, "tool-index.sqlite"))) {
      return projectData;
    }
  } catch {
    /* __dirname / import.meta.url 不可用 */
  }

  // 3. 标准 STATE_DIR（与 config/sessions/memory 同目录）
  try {
    const stateOverride =
      process.env.OPENCLAWCN_STATE_DIR?.trim() || process.env.CLAWDBOT_STATE_DIR?.trim();
    if (stateOverride) return stateOverride;
    const home = process.env.HOME || process.env.USERPROFILE;
    if (home) return join(home, ".openclawcn");
  } catch {
    /* fallback 失败 */
  }

  return undefined;
}
