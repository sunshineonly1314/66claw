#!/usr/bin/env node
/**
 * 监控批量清洗进度
 */

import fs from "node:fs/promises";
import path from "node:path";

const OUTPUT_BASE = "./skillsqingxi/output-batch";

async function monitor(batchNum) {
  const batchDir = path.join(OUTPUT_BASE, `batch-${batchNum}`);
  const indexPath = path.join(batchDir, "skills-index.json");

  try {
    const exists = await fs.access(indexPath).then(() => true).catch(() => false);

    if (!exists) {
      console.log(`⏳ 批次 ${batchNum} 尚未完成，等待中...`);
      return;
    }

    const index = JSON.parse(await fs.readFile(indexPath, "utf-8"));

    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 批次 ${batchNum} 进度`);
    console.log(`${"=".repeat(60)}\n`);

    console.log(`总扫描: ${index.stats.totalScanned}`);
    console.log(`收录数: ${index.stats.finalAccepted}`);
    console.log(`拒绝数: ${index.stats.totalScanned - index.stats.finalAccepted}`);
    console.log(`收录率: ${(index.stats.finalAccepted / index.stats.totalScanned * 100).toFixed(1)}%`);

    console.log(`\n评级分布:`);
    console.log(`  S: ${index.stats.tierDistribution.S}`);
    console.log(`  A: ${index.stats.tierDistribution.A}`);
    console.log(`  B: ${index.stats.tierDistribution.B}`);

    console.log(`\n✅ 批次 ${batchNum} 已完成！`);
    console.log(`📁 输出: ${batchDir}`);

  } catch (err) {
    console.log(`❌ 读取批次 ${batchNum} 结果失败: ${err.message}`);
  }
}

const batchNum = parseInt(process.argv[2]) || 1;
monitor(batchNum);
