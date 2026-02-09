#!/usr/bin/env node
/**
 * 自动化全流程清洗 - 串行执行所有批次
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

async function main() {
  const totalBatches = 11;

  console.log(`🚀 开始自动化清洗全部 ${totalBatches} 批次\n`);

  for (let i = 1; i <= totalBatches; i++) {
    console.log(`${"=".repeat(60)}`);
    console.log(`📦 批次 ${i}/${totalBatches}`);
    console.log(`${"=".repeat(60)}\n`);

    try {
      const { stdout, stderr } = await execAsync(
        `node scripts/unified-skill-wash.mjs --batch ${i}`,
        { timeout: 900000, maxBuffer: 50 * 1024 * 1024 }
      );

      console.log(stdout);
      if (stderr) console.error(stderr);

      console.log(`\n✅ 批次 ${i} 完成\n`);
    } catch (err) {
      console.error(`\n❌ 批次 ${i} 失败: ${err.message}\n`);
      process.exit(1);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`🎉 全部 ${totalBatches} 批次完成！`);
  console.log(`${"=".repeat(60)}\n`);
}

main().catch(err => {
  console.error("💥 自动化流程失败:", err);
  process.exit(1);
});
