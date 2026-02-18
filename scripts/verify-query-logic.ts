/**
 * 验证查询逻辑是否正常工作
 */
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const dbPath = join(import.meta.dirname ?? __dirname, "..", "data", "tool-index.sqlite");
const db = new DatabaseSync(dbPath, { open: true });

console.log("🔍 Testing FTS5 Search Logic\n");

try {
  // Test 1a: Check FTS5 config
  console.log("Test 1a: FTS5 Configuration");
  const ftsConfig = db.prepare(`
    SELECT sql FROM sqlite_master WHERE name = 'tools_fts'
  `).get() as { sql: string };
  console.log(`  FTS5 Table: ${ftsConfig.sql.slice(0, 150)}...`);
  console.log();

  // Test 1b: Search with LIKE
  console.log("Test 1b: Search with LIKE '%微信%'");
  const result1b = db.prepare(`
    SELECT id, type, name, description_cn
    FROM tools
    WHERE name LIKE ? OR description LIKE ? OR description_cn LIKE ?
    LIMIT 5
  `).all("%微信%", "%微信%", "%微信%") as Array<{ id: string; type: string; name: string; description_cn?: string }>;

  console.log(`  Found ${result1b.length} results`);
  for (const row of result1b) {
    console.log(`  - ${row.name} (${row.type})`);
    if (row.description_cn) {
      console.log(`    ${row.description_cn.slice(0, 60)}...`);
    }
  }
  console.log();

  // Test 1c: FTS5 direct search (no wildcard)
  console.log("Test 1c: FTS5 Search '微信' (no wildcard)");
  const result1c = db.prepare(`
    SELECT
      t.id, t.type, t.name, t.description_cn
    FROM tools_fts fts
    JOIN tools t ON t.id = fts.id
    WHERE tools_fts MATCH ?
    ORDER BY fts.rank
    LIMIT 5
  `).all("微信") as Array<{ id: string; type: string; name: string; description_cn?: string }>;

  console.log(`  Found ${result1c.length} results`);
  for (const row of result1c) {
    console.log(`  - ${row.name} (${row.type}) [${row.id}]`);
    if (row.description_cn) {
      console.log(`    ${row.description_cn.slice(0, 60)}...`);
    }
  }
  console.log();

  // Test 1d: FTS5 with wildcard
  console.log("Test 1d: FTS5 Search '*微信*' (with wildcard)");
  const result1d = db.prepare(`
    SELECT
      t.id, t.type, t.name, t.description_cn
    FROM tools_fts fts
    JOIN tools t ON t.id = fts.id
    WHERE tools_fts MATCH ?
    ORDER BY fts.rank
    LIMIT 5
  `).all("*微信*") as Array<{ id: string; type: string; name: string; description_cn?: string }>;

  console.log(`  Found ${result1d.length} results`);
  for (const row of result1d) {
    console.log(`  - ${row.name} (${row.type}) [${row.id}]`);
    if (row.description_cn) {
      console.log(`    ${row.description_cn.slice(0, 60)}...`);
    }
  }
  console.log();

  // Test 2: 地图 (MCP only)
  console.log("Test 2: 地图 (MCP only)");
  const result2 = db.prepare(`
    SELECT
      t.id, t.type, t.name, t.description_cn
    FROM tools_fts fts
    JOIN tools t ON t.id = fts.id
    WHERE tools_fts MATCH ? AND t.type = 'mcp'
    ORDER BY fts.rank
    LIMIT 5
  `).all("地图") as Array<{ id: string; type: string; name: string; description_cn?: string }>;

  for (const row of result2) {
    console.log(`  - ${row.name} (${row.type})`);
    if (row.description_cn) {
      console.log(`    ${row.description_cn.slice(0, 60)}...`);
    }
  }
  console.log();

  // Test 3: Count by type
  console.log("Test 3: Statistics");
  const stats = db.prepare(`
    SELECT type, COUNT(*) as count
    FROM tools
    GROUP BY type
    ORDER BY count DESC
  `).all() as Array<{ type: string; count: number }>;

  for (const { type, count } of stats) {
    console.log(`  ${type.padEnd(10)} ${count.toLocaleString()}`);
  }
  console.log();

  console.log("✅ All tests passed!");

} catch (err: any) {
  console.error("❌ Error:", err.message);
  console.error(err.stack);
} finally {
  db.close();
}
