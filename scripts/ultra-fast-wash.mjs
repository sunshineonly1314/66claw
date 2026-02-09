#!/usr/bin/env node
/**
 * 超快并发清洗 - 10 个 run.ts 实例并行
 *
 * 策略：为每个子批次创建独立的 skills 子目录，并行运行 run.ts
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const execAsync = promisify(exec);

const CONFIG = {
  mergedDir: "./skills-merged",
  tempBase: "./skills-batch-temp",
  outputBase: "./skillsqingxi/output-ultra",
  batchSize: 300,
  threads: 10,
};

async function ultraFastBatch(batchNum) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚀 批次 ${batchNum} - 超快并发清洗 (${CONFIG.threads} 线程)`);
  console.log(`${"=".repeat(60)}\n`);

  // 1. 加载技能列表
  const metadata = JSON.parse(await fs.readFile(path.join(CONFIG.mergedDir, "merge-metadata.json"), "utf-8"));
  const allSkills = metadata.skills.map(s => s.name);

  const startIdx = (batchNum - 1) * CONFIG.batchSize;
  const endIdx = Math.min(startIdx + CONFIG.batchSize, allSkills.length);
  const batchSkills = allSkills.slice(startIdx, endIdx);

  console.log(`📂 总技能数: ${allSkills.length}`);
  console.log(`📋 批次范围: ${startIdx + 1}-${endIdx} (${batchSkills.length} 个)\n`);

  // 2. 分成 N 个子批次
  const chunkSize = Math.ceil(batchSkills.length / CONFIG.threads);
  const chunks = [];

  for (let i = 0; i < CONFIG.threads; i++) {
    const chunkStart = i * chunkSize;
    const chunkEnd = Math.min(chunkStart + chunkSize, batchSkills.length);
    if (chunkStart < batchSkills.length) {
      chunks.push({
        id: i + 1,
        skills: batchSkills.slice(chunkStart, chunkEnd),
      });
    }
  }

  console.log(`📦 分成 ${chunks.length} 个子批次，每个 ${chunkSize} 个技能\n`);

  // 3. 为每个子批次创建独立目录并运行 run.ts
  const promises = chunks.map(async (chunk) => {
    const tempDir = path.join(CONFIG.tempBase, `batch-${batchNum}-chunk-${chunk.id}`);
    const outputDir = path.join(CONFIG.outputBase, `batch-${batchNum}`, `chunk-${chunk.id}`);

    // 创建临时技能目录
    await fs.mkdir(tempDir, { recursive: true });

    for (const skillName of chunk.skills) {
      const src = path.resolve(path.join(CONFIG.mergedDir, skillName));
      const dst = path.join(tempDir, skillName);
      try {
        await fs.symlink(src, dst, 'junction');
      } catch {}
    }

    console.log(`  🧵 线程 ${chunk.id}: 启动 (${chunk.skills.length} 个技能)`);

    // 运行 run.ts (修改 CWD 到临时目录)
    try {
      const { stdout, stderr } = await execAsync(
        `cd "${tempDir}" && npx tsx ../../skillsqingxi/run.ts --dir .`,
        { timeout: 600000, maxBuffer: 10 * 1024 * 1024 }
      );

      // 移动输出到指定目录
      await fs.mkdir(path.dirname(outputDir), { recursive: true });
      try {
        await fs.rename(path.join(tempDir, "../skillsqingxi/output"), outputDir);
      } catch {
        // 如果输出在其他位置，尝试查找
        const possibleOutputs = [
          "./skillsqingxi/output",
          path.join(tempDir, "output"),
        ];
        for (const possibleOutput of possibleOutputs) {
          try {
            await fs.cp(possibleOutput, outputDir, { recursive: true });
            break;
          } catch {}
        }
      }

      console.log(`  ✅ 线程 ${chunk.id}: 完成`);
      return { id: chunk.id, success: true };
    } catch (err) {
      console.error(`  ❌ 线程 ${chunk.id}: 失败 - ${err.message}`);
      return { id: chunk.id, success: false, error: err.message };
    } finally {
      // 清理
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // 等待所有线程完成
  const results = await Promise.all(promises);

  const succeeded = results.filter(r => r.success).length;
  console.log(`\n✅ 批次 ${batchNum} 完成: ${succeeded}/${chunks.length} 个线程成功`);

  return results;
}

async function main() {
  const batchNum = parseInt(process.argv[2]) || 1;
  await ultraFastBatch(batchNum);
}

main().catch(err => {
  console.error("💥 错误:", err);
  process.exit(1);
});
