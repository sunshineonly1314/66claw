#!/usr/bin/env node
/**
 * 简化版批量清洗 - 直接调用 skillsqingxi/run.ts
 *
 * 用法:
 *   node scripts/batch-wash-simple.mjs 1    # 清洗第 1 批（1-300）
 *   node scripts/batch-wash-simple.mjs 2    # 清洗第 2 批（301-600）
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const execAsync = promisify(exec);

const BATCH_SIZE = 300;
const SOURCE_DIR = "./skills-awesome";
const OUTPUT_BASE = "./skillsqingxi/output-batch";

async function main() {
  const batchNum = parseInt(process.argv[2]);

  if (!batchNum || batchNum < 1) {
    console.log("用法: node scripts/batch-wash-simple.mjs <batch-number>");
    console.log("示例: node scripts/batch-wash-simple.mjs 1");
    process.exit(1);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚀 批次 ${batchNum} 清洗`);
  console.log(`${"=".repeat(60)}\n`);

  // 1. 扫描所有技能
  const allSkills = await fs.readdir(SOURCE_DIR, { withFileTypes: true });
  const skillDirs = allSkills.filter(e => e.isDirectory()).map(e => e.name);

  const startIdx = (batchNum - 1) * BATCH_SIZE;
  const endIdx = Math.min(startIdx + BATCH_SIZE, skillDirs.length);

  if (startIdx >= skillDirs.length) {
    console.log(`❌ 批次 ${batchNum} 超出范围（总共 ${skillDirs.length} 个技能）`);
    process.exit(1);
  }

  const batchSkills = skillDirs.slice(startIdx, endIdx);

  console.log(`📂 总技能数: ${skillDirs.length}`);
  console.log(`📋 批次范围: ${startIdx + 1}-${endIdx} (${batchSkills.length} 个)`);

  // 2. 创建临时 skills 目录（仅包含本批次技能）
  const tempSkillsDir = `./skills-batch-${batchNum}-temp`;
  await fs.mkdir(tempSkillsDir, { recursive: true });

  console.log(`\n📦 准备临时技能目录...`);
  for (const skillName of batchSkills) {
    const src = path.join(SOURCE_DIR, skillName);
    const dst = path.join(tempSkillsDir, skillName);

    // 创建符号链接（Windows 上可能需要管理员权限，改用复制）
    try {
      await fs.cp(src, dst, { recursive: true });
    } catch (err) {
      console.warn(`  ⚠️  跳过 ${skillName}: ${err.message}`);
    }
  }

  console.log(`✅ 临时目录准备完成: ${batchSkills.length} 个技能`);

  // 3. 运行 skillsqingxi/run.ts（修改输入/输出目录）
  console.log(`\n🔄 开始清洗...`);

  const outputDir = path.join(OUTPUT_BASE, `batch-${batchNum}`);

  // 临时修改环境变量
  const env = {
    ...process.env,
    SKILLWASH_INPUT_DIR: tempSkillsDir,
    SKILLWASH_OUTPUT_DIR: outputDir,
  };

  try {
    const { stdout, stderr } = await execAsync(
      "npx tsx skillsqingxi/run.ts",
      { env, timeout: 600000 }, // 10 分钟超时
    );

    console.log(stdout);
    if (stderr) console.error(stderr);

    console.log(`\n✅ 批次 ${batchNum} 完成！`);
    console.log(`📁 输出目录: ${outputDir}`);

  } catch (err) {
    console.error(`\n❌ 清洗失败:`, err.message);
    process.exit(1);
  } finally {
    // 4. 清理临时目录
    console.log(`\n🗑️  清理临时目录...`);
    await fs.rm(tempSkillsDir, { recursive: true, force: true });
  }

  // 5. 保存 checkpoint
  const checkpoint = {
    lastBatch: batchNum,
    timestamp: new Date().toISOString(),
    skillsProcessed: endIdx,
    totalSkills: skillDirs.length,
  };

  await fs.mkdir(OUTPUT_BASE, { recursive: true });
  await fs.writeFile(
    path.join(OUTPUT_BASE, "checkpoint.json"),
    JSON.stringify(checkpoint, null, 2),
    "utf-8",
  );

  console.log(`\n💾 Checkpoint 已保存`);
}

main().catch((err) => {
  console.error("💥 批量清洗异常:", err);
  process.exit(1);
});
