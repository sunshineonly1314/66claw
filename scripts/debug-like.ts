import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const dbPath = join(import.meta.dirname ?? __dirname, "..", "data", "tool-index.sqlite");
const db = new DatabaseSync(dbPath, { open: true });

console.log("Testing LIKE query with ESCAPE syntax\n");

const testQueries = ["微信", "地图", "文件"];

for (const query of testQueries) {
  console.log(`Query: "${query}"`);

  const likeTerm = query.replace(/[%_\\]/g, "\\$&");
  const pattern = `%${likeTerm}%`;

  // Test 1: Without ESCAPE
  console.log(`  Pattern: "${pattern}"`);
  try {
    const result1 = db.prepare(`
      SELECT id, name, description_cn
      FROM tools
      WHERE name LIKE ? OR description LIKE ? OR description_cn LIKE ?
      LIMIT 3
    `).all(pattern, pattern, pattern);
    console.log(`  Without ESCAPE: ${result1.length} results`);
    if (result1.length > 0) {
      for (const r of result1 as any[]) {
        console.log(`    - ${r.name}`);
      }
    }
  } catch (err: any) {
    console.log(`  Without ESCAPE: Error - ${err.message}`);
  }

  // Test 2: With ESCAPE '\\'
  try {
    const result2 = db.prepare(`
      SELECT id, name, description_cn
      FROM tools
      WHERE (name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR description_cn LIKE ? ESCAPE '\\')
      LIMIT 3
    `).all(pattern, pattern, pattern);
    console.log(`  With ESCAPE '\\\\': ${result2.length} results`);
    if (result2.length > 0) {
      for (const r of result2 as any[]) {
        console.log(`    - ${r.name}`);
      }
    }
  } catch (err: any) {
    console.log(`  With ESCAPE '\\\\': Error - ${err.message}`);
  }

  console.log();
}

db.close();
