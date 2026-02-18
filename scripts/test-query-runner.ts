/**
 * 快速测试查询工具的包装脚本
 */
import { spawn } from "node:child_process";
import { join } from "node:path";

const scriptPath = join(import.meta.dirname ?? __dirname, "query-tools.ts");

const testQueries = [
  ["微信", "--limit", "5"],
  ["地图", "--limit", "3", "--type", "mcp"],
  ["搜索", "--limit", "5", "--china"],
];

console.log("🔍 Running query tool tests...\n");

for (const [i, args] of testQueries.entries()) {
  console.log(`\n=== Test ${i + 1}: ${args.join(" ")} ===\n`);

  const proc = spawn("node", ["--experimental-strip-types", scriptPath, ...args], {
    cwd: join(import.meta.dirname ?? __dirname, ".."),
    stdio: "inherit",
  });

  await new Promise<void>((resolve) => {
    proc.on("close", () => resolve());
  });
}

console.log("\n✅ All tests completed!");
