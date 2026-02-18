/**
 * [CN-PATCH:tool-discovery] 统一工具查询命令行工具
 *
 * 用法：
 *   pnpm query-tool "微信"
 *   pnpm query-tool "地图导航" --limit 10
 *   pnpm query-tool "文件管理" --type skill
 *   pnpm query-tool "搜索引擎" --type mcp --china
 *
 * 选项：
 *   --limit <n>      限制结果数量（默认20）
 *   --type <type>    过滤类型: core, mcp, skill
 *   --china          仅显示中国可用的工具
 *   --json           输出JSON格式
 */

import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { existsSync } from "node:fs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ToolEntry {
  id: string;
  type: "core" | "mcp" | "skill";
  name: string;
  description: string;
  descriptionCn?: string;
  tags: string;
  metadataJson?: string;
  score?: number;
}

interface QueryOptions {
  query: string;
  limit?: number;
  type?: "core" | "mcp" | "skill";
  chinaOnly?: boolean;
  jsonOutput?: boolean;
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

function openDatabase(dbPath: string): DatabaseSync {
  if (!existsSync(dbPath)) {
    throw new Error(`Database not found: ${dbPath}\nRun: pnpm build:tool-index`);
  }
  return new DatabaseSync(dbPath, { open: true });
}

// ---------------------------------------------------------------------------
// FTS5 Search
// ---------------------------------------------------------------------------

function searchTools(db: DatabaseSync, options: QueryOptions): ToolEntry[] {
  const { query, limit = 20, type, chinaOnly = false } = options;

  const rawQuery = query.trim();
  if (!rawQuery) {
    throw new Error("Query cannot be empty");
  }

  let results: ToolEntry[] = [];
  const seen = new Set<string>();

  // 1) FTS5 Search (with 3-gram sliding window for Chinese)
  const ftsQuery = buildFtsQuery(rawQuery);
  if (ftsQuery) {
    try {
      let sql = `
        SELECT
          t.id,
          t.type,
          t.name,
          t.description,
          t.description_cn as descriptionCn,
          t.tags,
          t.metadata_json as metadataJson,
          fts.rank as score
        FROM tools_fts fts
        JOIN tools t ON t.id = fts.id
        WHERE tools_fts MATCH ?
      `;

      const params: any[] = [ftsQuery];

      if (type) {
        sql += ` AND t.type = ?`;
        params.push(type);
      }

      if (chinaOnly) {
        sql += ` AND (t.metadata_json LIKE '%"availability"%"china"%"available"%' OR t.type = 'core')`;
      }

      sql += ` ORDER BY fts.rank LIMIT ?`;
      params.push(limit);

      const ftsResults = db.prepare(sql).all(...params) as ToolEntry[];
      for (const r of ftsResults) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          results.push(r);
        }
      }
    } catch (err: any) {
      console.warn(`FTS5 search failed: ${err.message}`);
    }
  }

  // 2) LIKE Fallback (for short Chinese queries like "微信")
  if (results.length < limit) {
    const likeTerm = rawQuery.replace(/[%_\\]/g, "\\$&");
    const pattern = `%${likeTerm}%`;

    let sql = `
      SELECT
        id,
        type,
        name,
        description,
        description_cn as descriptionCn,
        tags,
        metadata_json as metadataJson,
        -1 as score
      FROM tools
      WHERE (name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR description_cn LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\')
    `;

    const params: any[] = [pattern, pattern, pattern, pattern];

    if (type) {
      sql += ` AND type = ?`;
      params.push(type);
    }

    if (chinaOnly) {
      sql += ` AND (metadata_json LIKE '%"availability"%"china"%"available"%' OR type = 'core')`;
    }

    sql += ` LIMIT ?`;
    params.push(limit - results.length);

    try {
      const likeResults = db.prepare(sql).all(...params) as ToolEntry[];
      for (const r of likeResults) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          results.push(r);
        }
      }
    } catch (err: any) {
      console.warn(`LIKE search failed: ${err.message}`);
    }
  }

  // Parse tags
  for (const result of results) {
    if (typeof result.tags === "string") {
      try {
        const parsed = JSON.parse(result.tags);
        result.tags = Array.isArray(parsed) ? parsed.join(", ") : result.tags;
      } catch {
        // Keep as string
      }
    }
  }

  return results;
}

/**
 * 转义 FTS5 特殊字符。
 * FTS5 规则: 双引号需转义为两个双引号 ("" 表示字面 ")
 */
function escapeFtsToken(term: string): string {
  return term.replace(/"/g, '""');
}

/**
 * Build FTS5 query with 3-gram sliding window for Chinese
 */
function buildFtsQuery(raw: string): string | null {
  const cleaned = raw.replace(/['"{}()\[\]]/g, " ").trim();
  if (cleaned.length < 2) return null;

  const terms: string[] = [];

  // CJK blocks with 3-char sliding window
  const cjkBlocks = cleaned.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+/g) || [];
  for (const block of cjkBlocks) {
    const chars = [...block];
    if (chars.length >= 3) {
      for (let i = 0; i <= chars.length - 3; i++) {
        terms.push(chars[i] + chars[i + 1] + chars[i + 2]);
      }
    }
    if (chars.length >= 4) {
      terms.push(block);
    }
  }

  // English words (>=3 chars)
  const ascii = cleaned
    .replace(/[^a-zA-Z0-9\s_-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  terms.push(...ascii);

  const unique = [...new Set(terms)].slice(0, 20);
  if (unique.length === 0) return null;

  // FIX: 转义双引号 (FTS5 规则: " → "")
  return unique.map((t) => `"${escapeFtsToken(t)}"`).join(" OR ");
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

function displayResults(results: ToolEntry[], options: QueryOptions): void {
  if (options.jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (results.length === 0) {
    console.log("\n❌ No results found.\n");
    return;
  }

  console.log(`\n📊 Found ${results.length} results:\n`);

  for (const [i, result] of results.entries()) {
    const typeIcon =
      result.type === "core" ? "⚙️" :
      result.type === "mcp" ? "🔌" : "🎯";

    console.log(`${i + 1}. ${typeIcon} ${result.name} (${result.type})`);
    console.log(`   ID: ${result.id}`);

    const desc = result.descriptionCn || result.description || "无描述";
    const shortDesc = desc.length > 100 ? desc.slice(0, 100) + "..." : desc;
    console.log(`   ${shortDesc}`);

    if (result.tags && result.tags !== "[]") {
      console.log(`   标签: ${result.tags}`);
    }

    // Show China availability for MCP/Skills
    if (result.metadataJson && (result.type === "mcp" || result.type === "skill")) {
      try {
        const meta = JSON.parse(result.metadataJson);
        if (meta.availability?.china?.status) {
          const status = meta.availability.china.status;
          const icon = status === "available" ? "✅" :
                      status === "vpn_required" ? "🌐" : "⚠️";
          console.log(`   ${icon} 中国可用性: ${status}`);
        }
      } catch {
        // Skip
      }
    }

    console.log();
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(): QueryOptions {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(`
统一工具查询工具

用法:
  pnpm query-tool <查询词> [选项]

示例:
  pnpm query-tool "微信"
  pnpm query-tool "地图导航" --limit 10
  pnpm query-tool "文件管理" --type skill
  pnpm query-tool "搜索引擎" --type mcp --china

选项:
  --limit <n>      限制结果数量（默认20）
  --type <type>    过滤类型: core, mcp, skill
  --china          仅显示中国可用的工具
  --json           输出JSON格式
  --help, -h       显示帮助信息
`);
    process.exit(0);
  }

  const options: QueryOptions = {
    query: args[0],
    limit: 20,
    jsonOutput: false,
    chinaOnly: false,
  };

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case "--limit":
        options.limit = parseInt(args[++i], 10);
        break;
      case "--type":
        options.type = args[++i] as any;
        break;
      case "--china":
        options.chinaOnly = true;
        break;
      case "--json":
        options.jsonOutput = true;
        break;
    }
  }

  return options;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const options = parseArgs();

  const dbPath = join(import.meta.dirname ?? __dirname, "..", "data", "tool-index.sqlite");
  const db = openDatabase(dbPath);

  try {
    const results = searchTools(db, options);
    displayResults(results, options);
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
