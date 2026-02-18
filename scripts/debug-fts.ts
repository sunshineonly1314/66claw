import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const dbPath = join(import.meta.dirname ?? __dirname, "..", "data", "tool-index.sqlite");
const db = new DatabaseSync(dbPath, { open: true });

console.log("Testing FTS5 3-gram query\n");

// Simulate buildFtsQuery for "地图导航"
const query = "地图导航";
const chars = [...query];
const terms: string[] = [];

for (let i = 0; i <= chars.length - 3; i++) {
  terms.push(chars[i] + chars[i + 1] + chars[i + 2]);
}
if (chars.length >= 4) {
  terms.push(query);
}

const ftsQuery = terms.map((t) => `"${t}"`).join(" OR ");
console.log(`Query: "${query}"`);
console.log(`FTS5 Query: ${ftsQuery}`);
console.log();

try {
  const result = db.prepare(`
    SELECT t.id, t.name, t.description_cn, fts.rank
    FROM tools_fts fts
    JOIN tools t ON t.id = fts.id
    WHERE tools_fts MATCH ?
    ORDER BY fts.rank
    LIMIT 5
  `).all(ftsQuery);

  console.log(`FTS5 Results: ${result.length}`);
  for (const r of result as any[]) {
    console.log(`  - ${r.name}`);
    if (r.description_cn) {
      console.log(`    ${r.description_cn.slice(0, 60)}...`);
    }
  }
} catch (err: any) {
  console.log(`FTS5 Error: ${err.message}`);
}

console.log();

// Try LIKE fallback
const pattern = `%${query}%`;
const likeResult = db.prepare(`
  SELECT id, name, description_cn
  FROM tools
  WHERE name LIKE ? OR description LIKE ? OR description_cn LIKE ?
  LIMIT 5
`).all(pattern, pattern, pattern);

console.log(`LIKE Results: ${likeResult.length}`);
for (const r of likeResult as any[]) {
  console.log(`  - ${r.name}`);
  if (r.description_cn) {
    console.log(`    ${r.description_cn.slice(0, 60)}...`);
  }
}

db.close();
