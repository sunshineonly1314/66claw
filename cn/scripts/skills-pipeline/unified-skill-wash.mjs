#!/usr/bin/env node
/**
 * 统一技能清洗器 - 并发 5 线程
 *
 * 合并 3 个来源的技能，去重后批量清洗：
 * 1. skills/ (55 个本地技能)
 * 2. skills-awesome/ (2899 个 awesome 下载)
 * 3. cn/skills-mirror/skills/ (991 个 proxy 镜像)
 *
 * 用法:
 *   node scripts/unified-skill-wash.mjs --merge      # 去重合并
 *   node scripts/unified-skill-wash.mjs --batch 1    # 清洗第 1 批（并发 5）
 *   node scripts/unified-skill-wash.mjs --stats      # 查看统计
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const execAsync = promisify(exec);

const CONFIG = {
  sources: [
    { name: "local", path: "./skills", priority: 1 },              // 优先级最高
    { name: "mirror", path: "./cn/skills-mirror/skills", priority: 2 },
    { name: "awesome", path: "./skills-awesome", priority: 3 },
  ],
  mergedDir: "./skills-merged",           // 合并后的技能目录
  outputBase: "./cn/skills-qc/output-unified",
  batchSize: 300,
  concurrency: 10,                       // 并发 10 线程！
};

// ============================================================================
// 去重合并
// ============================================================================

async function mergeSkills() {
  console.log("═".repeat(60));
  console.log("🔀 合并去重所有技能来源");
  console.log("═".repeat(60));

  const allSkills = new Map(); // skillName -> { source, path, priority }

  // 1. 扫描所有来源
  for (const source of CONFIG.sources) {
    console.log(`\n📂 扫描 ${source.name} (${source.path})...`);

    try {
      const entries = await fs.readdir(source.path, { withFileTypes: true });
      const skillDirs = entries.filter(e => e.isDirectory());

      console.log(`   找到 ${skillDirs.length} 个技能`);

      for (const dir of skillDirs) {
        const skillName = dir.name;
        const skillPath = path.join(source.path, skillName);

        // 检查是否有 SKILL.md
        const skillMdPath = path.join(skillPath, "SKILL.md");
        try {
          await fs.access(skillMdPath);
        } catch {
          console.log(`   ⚠️  跳过 ${skillName}: 无 SKILL.md`);
          continue;
        }

        // 去重逻辑：保留优先级高的
        if (allSkills.has(skillName)) {
          const existing = allSkills.get(skillName);
          if (source.priority < existing.priority) {
            // 当前来源优先级更高，替换
            console.log(`   🔄 ${skillName}: ${existing.source} → ${source.name}`);
            allSkills.set(skillName, { source: source.name, path: skillPath, priority: source.priority });
          } else {
            console.log(`   ⏭️  ${skillName}: 保留 ${existing.source}`);
          }
        } else {
          allSkills.set(skillName, { source: source.name, path: skillPath, priority: source.priority });
        }
      }
    } catch (err) {
      console.warn(`   ❌ 扫描失败: ${err.message}`);
    }
  }

  console.log(`\n📊 合并统计:`);
  console.log(`   总技能数: ${allSkills.size}`);

  const bySource = {};
  for (const [, info] of allSkills) {
    bySource[info.source] = (bySource[info.source] || 0) + 1;
  }
  for (const [source, count] of Object.entries(bySource)) {
    console.log(`   ${source}: ${count}`);
  }

  // 2. 创建符号链接到 merged 目录
  console.log(`\n📦 创建合并目录: ${CONFIG.mergedDir}`);

  await fs.rm(CONFIG.mergedDir, { recursive: true, force: true });
  await fs.mkdir(CONFIG.mergedDir, { recursive: true });

  let copied = 0;
  for (const [skillName, info] of allSkills) {
    const src = path.resolve(info.path);
    const dst = path.join(CONFIG.mergedDir, skillName);

    try {
      // 使用符号链接加速（无需复制文件）
      try {
        await fs.symlink(src, dst, 'junction'); // Windows junction
      } catch {
        // 如果符号链接失败，回退到复制
        await fs.cp(src, dst, { recursive: true });
      }
      copied++;

      if (copied % 500 === 0) {
        console.log(`   已处理 ${copied}/${allSkills.size}...`);
      }
    } catch (err) {
      console.warn(`   ⚠️  处理失败 ${skillName}: ${err.message}`);
    }
  }

  console.log(`✅ 合并完成: ${copied} 个技能 → ${CONFIG.mergedDir}`);

  // 3. 保存元数据
  const metadata = {
    generatedAt: new Date().toISOString(),
    totalSkills: allSkills.size,
    sources: bySource,
    skills: Array.from(allSkills.entries()).map(([name, info]) => ({
      name,
      source: info.source,
      originalPath: info.path,
    })),
  };

  await fs.writeFile(
    path.join(CONFIG.mergedDir, "merge-metadata.json"),
    JSON.stringify(metadata, null, 2),
    "utf-8",
  );

  console.log(`💾 元数据已保存: ${CONFIG.mergedDir}/merge-metadata.json`);
}

// ============================================================================
// 并发批量清洗（5 线程）
// ============================================================================

async function washBatchConcurrent(batchNum) {
  console.log("═".repeat(60));
  console.log(`🚀 批次 ${batchNum} 清洗（并发 ${CONFIG.concurrency} 线程）`);
  console.log("═".repeat(60));

  // 1. 加载合并后的技能列表
  const metadataPath = path.join(CONFIG.mergedDir, "merge-metadata.json");
  let allSkills;

  try {
    const metadata = JSON.parse(await fs.readFile(metadataPath, "utf-8"));
    allSkills = metadata.skills.map(s => s.name);
  } catch {
    console.error("❌ 未找到合并元数据，请先运行 --merge");
    process.exit(1);
  }

  // 2. 计算批次范围
  const startIdx = (batchNum - 1) * CONFIG.batchSize;
  const endIdx = Math.min(startIdx + CONFIG.batchSize, allSkills.length);

  if (startIdx >= allSkills.length) {
    console.log(`❌ 批次 ${batchNum} 超出范围（总共 ${allSkills.length} 个技能）`);
    process.exit(1);
  }

  const batchSkills = allSkills.slice(startIdx, endIdx);

  console.log(`📂 总技能数: ${allSkills.length}`);
  console.log(`📋 批次范围: ${startIdx + 1}-${endIdx} (${batchSkills.length} 个)`);

  // 3. 将 300 个技能分成 5 个子批次（每个 60 个）
  const chunkSize = Math.ceil(batchSkills.length / CONFIG.concurrency);
  const chunks = [];

  for (let i = 0; i < CONFIG.concurrency; i++) {
    const chunkStart = i * chunkSize;
    const chunkEnd = Math.min(chunkStart + chunkSize, batchSkills.length);
    if (chunkStart < batchSkills.length) {
      chunks.push({
        id: i + 1,
        skills: batchSkills.slice(chunkStart, chunkEnd),
        startIdx: startIdx + chunkStart,
      });
    }
  }

  console.log(`\n📦 分成 ${chunks.length} 个子批次，每个约 ${chunkSize} 个技能`);

  // 4. 并发运行 5 个清洗进程
  const outputDir = path.join(CONFIG.outputBase, `batch-${batchNum}`);
  await fs.mkdir(outputDir, { recursive: true });

  console.log(`\n🔄 启动 ${chunks.length} 个并发清洗线程...\n`);

  const promises = chunks.map(async (chunk) => {
    // 为每个子批次创建临时目录
    const tempDir = `./skills-batch-${batchNum}-chunk-${chunk.id}-temp`;

    await fs.mkdir(tempDir, { recursive: true });

    // 复制技能到临时目录（解决嵌套 junction 问题）
    for (const skillName of chunk.skills) {
      const src = path.join(CONFIG.mergedDir, skillName);
      const dst = path.join(tempDir, skillName);
      try {
        await fs.cp(src, dst, { recursive: true, dereference: true });
      } catch {
        // 跳过失败的
      }
    }

    console.log(`  🧵 线程 ${chunk.id}: 处理 ${chunk.skills.length} 个技能 (${chunk.startIdx + 1}-${chunk.startIdx + chunk.skills.length})`);

    // 运行 cn/skills-qc/run.ts - 每个子进程独立输出目录
    const chunkOutputDir = path.resolve(path.join(outputDir, `chunk-${chunk.id}`));
    const env = {
      ...process.env,
      SKILLWASH_API_KEY: process.env.SKILLWASH_API_KEY || process.env.QWEN_API_KEY || "",
      SKILLWASH_OUTPUT_DIR: chunkOutputDir,
      SKILLWASH_CONCURRENCY: "1",  // 每线程1并发，10线程=10总并发
    };

    try {
      const { stdout, stderr } = await execAsync(`npx tsx cn/skills-qc/run.ts --dir "${tempDir}"`, { env, timeout: 900000, maxBuffer: 50 * 1024 * 1024, cwd: process.cwd() });

      // 提取收录统计
      const acceptMatch = stdout.match(/✅ 收录: (\d+)/);
      const rejectMatch = stdout.match(/❌ 淘汰: (\d+)/);
      const accepted = acceptMatch ? acceptMatch[1] : "?";
      const rejected = rejectMatch ? rejectMatch[1] : "?";
      console.log(`  ✅ 线程 ${chunk.id}: 完成 (收录 ${accepted}, 淘汰 ${rejected})`);
    } catch (err) {
      // execAsync throws on non-zero exit, but stdout may still have useful output
      const stdout = err.stdout || "";
      const stderr = err.stderr || "";
      console.error(`  ❌ 线程 ${chunk.id}: 失败 - ${stderr.split('\n')[0] || err.message}`);
    } finally {
      // 清理临时目录
      await fs.rm(tempDir, { recursive: true, force: true });
    }

    return chunk.id;
  });

  // 等待所有线程完成
  const results = await Promise.allSettled(promises);

  console.log(`\n${"═".repeat(60)}`);
  console.log(`📊 批次 ${batchNum} 完成统计`);
  console.log(`${"═".repeat(60)}\n`);

  const succeeded = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;

  console.log(`成功: ${succeeded}/${chunks.length} 个线程`);
  console.log(`失败: ${failed}/${chunks.length} 个线程`);

  // 5. 合并所有子批次的结果
  console.log(`\n🔀 合并子批次结果...`);

  const mergedIndex = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    pipelineVersion: "2.0.0",
    stats: {
      totalScanned: 0,
      finalAccepted: 0,
      tierDistribution: { S: 0, A: 0, B: 0 },
    },
    skills: [],
  };

  for (let i = 1; i <= chunks.length; i++) {
    // skills-index.json 在 chunk 输出目录根下
    const chunkDir = path.join(outputDir, `chunk-${i}`);
    const chunkIndexPath = path.join(chunkDir, "skills-index.json");

    try {
      await fs.access(chunkIndexPath);
      const chunkIndex = JSON.parse(await fs.readFile(chunkIndexPath, "utf-8"));

      mergedIndex.stats.totalScanned += chunkIndex.stats.totalScanned;
      mergedIndex.stats.finalAccepted += chunkIndex.stats.finalAccepted;
      mergedIndex.stats.tierDistribution.S += chunkIndex.stats.tierDistribution?.S ?? 0;
      mergedIndex.stats.tierDistribution.A += chunkIndex.stats.tierDistribution?.A ?? 0;
      mergedIndex.stats.tierDistribution.B += chunkIndex.stats.tierDistribution?.B ?? 0;
      mergedIndex.skills.push(...(chunkIndex.skills ?? []));
      console.log(`  ✅ 子批次 ${i}: ${chunkIndex.stats.finalAccepted}/${chunkIndex.stats.totalScanned} 收录`);
    } catch (err) {
      // 尝试从 report 目录查找结果
      const reportDir = path.join(chunkDir, "report");
      try {
        const reportFiles = await fs.readdir(reportDir);
        const jsonFiles = reportFiles.filter(f => f.endsWith(".json") && !f.startsWith("wash-") && !f.startsWith("rejected") && !f.startsWith("review"));
        console.log(`  ⚠️  子批次 ${i}: 无索引，但有 ${jsonFiles.length} 个报告文件`);
      } catch {
        console.warn(`  ⚠️  子批次 ${i}: 结果完全缺失`);
      }
    }
  }

  // 保存合并后的索引
  await fs.writeFile(
    path.join(outputDir, "skills-index.json"),
    JSON.stringify(mergedIndex, null, 2),
    "utf-8",
  );

  console.log(`✅ 合并索引已保存: ${outputDir}/skills-index.json`);

  // 6. 保存 checkpoint
  const checkpoint = {
    lastBatch: batchNum,
    timestamp: new Date().toISOString(),
    skillsProcessed: endIdx,
    totalSkills: allSkills.length,
  };

  await fs.mkdir(CONFIG.outputBase, { recursive: true });
  await fs.writeFile(
    path.join(CONFIG.outputBase, "checkpoint.json"),
    JSON.stringify(checkpoint, null, 2),
    "utf-8",
  );

  console.log(`\n💾 Checkpoint 已保存`);
  console.log(`\n📊 批次 ${batchNum} 最终结果:`);
  console.log(`   总扫描: ${mergedIndex.stats.totalScanned}`);
  console.log(`   收录数: ${mergedIndex.stats.finalAccepted}`);
  console.log(`   收录率: ${(mergedIndex.stats.finalAccepted / mergedIndex.stats.totalScanned * 100).toFixed(1)}%`);
}

// ============================================================================
// 统计
// ============================================================================

async function showStats() {
  const metadataPath = path.join(CONFIG.mergedDir, "merge-metadata.json");

  try {
    const metadata = JSON.parse(await fs.readFile(metadataPath, "utf-8"));

    console.log("═".repeat(60));
    console.log("📊 技能合并统计");
    console.log("═".repeat(60));

    console.log(`\n总技能数: ${metadata.totalSkills}`);
    console.log(`\n来源分布:`);
    for (const [source, count] of Object.entries(metadata.sources)) {
      console.log(`  ${source}: ${count}`);
    }

    console.log(`\n批次配置:`);
    console.log(`  批次大小: ${CONFIG.batchSize}`);
    console.log(`  并发线程: ${CONFIG.concurrency}`);
    console.log(`  预计批次数: ${Math.ceil(metadata.totalSkills / CONFIG.batchSize)}`);

  } catch {
    console.error("❌ 未找到合并元数据，请先运行 --merge");
  }
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  统一技能清洗器 - 并发 5 线程                           ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  用法:                                                   ║
║    node scripts/unified-skill-wash.mjs --merge          ║
║    node scripts/unified-skill-wash.mjs --batch N        ║
║    node scripts/unified-skill-wash.mjs --stats          ║
║                                                          ║
║  来源:                                                   ║
║    skills/                        (55 本地)             ║
║    cn/skills-mirror/skills/ (991 镜像)            ║
║    skills-awesome/                (2899 awesome)        ║
║                                                          ║
║  去重规则: 优先级 local > mirror > awesome              ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`);
    return;
  }

  if (args.includes("--merge")) {
    await mergeSkills();
    return;
  }

  const batchIdx = args.indexOf("--batch");
  if (batchIdx !== -1) {
    const batchNum = parseInt(args[batchIdx + 1]);
    if (isNaN(batchNum) || batchNum < 1) {
      console.error("❌ 批次号必须是正整数");
      process.exit(1);
    }
    await washBatchConcurrent(batchNum);
    return;
  }

  if (args.includes("--stats")) {
    await showStats();
    return;
  }

  console.log("使用 --help 查看帮助");
}

main().catch((err) => {
  console.error("💥 统一清洗器异常:", err);
  process.exit(1);
});
