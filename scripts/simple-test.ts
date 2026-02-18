import { exec } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";

const execAsync = promisify(exec);

const tests = [
  { query: "微信", args: "--limit 5", desc: "Short Chinese (LIKE fallback)" },
  { query: "地图导航", args: "--limit 5 --type mcp", desc: "FTS5 3-gram" },
  { query: "search", args: "--limit 5 --china", desc: "English query" },
  { query: "文件", args: "--limit 3 --type skill", desc: "Skills only" },
];

for (const { query, args, desc } of tests) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Test: ${desc}`);
  console.log(`Query: "${query}" ${args}`);
  console.log("=".repeat(60));

  try {
    const scriptPath = join(import.meta.dirname || __dirname, "query-tools.ts");
    const cmd = `node --experimental-strip-types "${scriptPath}" "${query}" ${args}`;
    const rootDir = join(import.meta.dirname || __dirname, "..");
    const { stdout, stderr } = await execAsync(cmd, { cwd: rootDir });
    console.log(stdout);
    if (stderr && !stderr.includes("ExperimentalWarning")) console.error("Warnings:", stderr);
  } catch (err: any) {
    console.error("❌ Error:", err.message);
  }
}

console.log("\n✅ All tests completed!\n");
