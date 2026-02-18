import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const dbPath = join(import.meta.dirname ?? __dirname, "..", "data", "tool-index.sqlite");
const db = new DatabaseSync(dbPath, { open: true });

console.log("📊 Tool Index Statistics\n");

try {
  // List all tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as Array<{ name: string }>;
  console.log("Tables:");
  for (const { name } of tables) {
    console.log(`  - ${name}`);
  }
  console.log();

  // Use tools table
  const tableName = "tools";
  const ftsTableName = "tools_fts";

  // Total count
  const total = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number };
  console.log(`Total entries: ${total.count}\n`);

  // By type
  const byType = db.prepare(`SELECT type, COUNT(*) as count FROM ${tableName} GROUP BY type ORDER BY count DESC`).all() as Array<{ type: string; count: number }>;
  console.log("By type:");
  for (const { type, count } of byType) {
    console.log(`  ${type.padEnd(10)} ${count.toLocaleString()}`);
  }
  console.log();

  // Sample entries
  for (const type of ["core", "mcp", "skill"]) {
    const sample = db.prepare(`SELECT id, name, description FROM ${tableName} WHERE type = ? LIMIT 3`).all(type) as Array<{ id: string; name: string; description: string }>;
    if (sample.length > 0) {
      console.log(`${type.toUpperCase()} samples:`);
      for (const { id, name, description } of sample) {
        console.log(`  - ${name} (${id})`);
        console.log(`    ${description.slice(0, 60)}...`);
      }
      console.log();
    }
  }

  // Check if vectorization is enabled
  const metaCount = db.prepare("SELECT COUNT(*) as count FROM tool_meta").get() as { count: number };
  const vectorized = metaCount.count > 0 ? "Partial" : "No";
  console.log(`Vectorization: ${vectorized}`);
  if (metaCount.count > 0) {
    const meta = db.prepare("SELECT * FROM tool_meta LIMIT 5").all() as Array<{ id: string; embedding_vector?: any }>;
    console.log(`  - Vectorized entries: ${metaCount.count}`);
  }
} finally {
  db.close();
}
