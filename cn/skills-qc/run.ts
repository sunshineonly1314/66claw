/**
 * SkillWash 清洗工程 — 入口
 *
 * 用法:
 *   bun cn/skills-qc/run.ts <SKILL.md 路径>              单个清洗
 *   bun cn/skills-qc/run.ts --dir skills/                批量清洗
 *   bun cn/skills-qc/run.ts --dir skills/ --resume <cp>  断点续跑
 */

import fs from "node:fs";
import path from "node:path";
import { washSingleSkill, generateBatchReports } from "./pipeline.js";
import { QWEN_CONFIG, OUTPUT_DIR, CHECKPOINT_CONFIG } from "./config.js";
import type { PipelineResult, Checkpoint } from "./types.js";

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
╔══════════════════════════════════════════════════╗
║   SkillWash — Skills 清洗工程 v1.1               ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  用法:                                           ║
║    bun cn/skills-qc/run.ts <SKILL.md>            ║
║    bun cn/skills-qc/run.ts --dir <skills/>       ║
║    bun cn/skills-qc/run.ts --dir <dir> --resume  ║
║                                                  ║
║  配置:                                           ║
║    模型: ${QWEN_CONFIG.model.padEnd(34)}║
║    并发: ${String(QWEN_CONFIG.concurrency).padEnd(34)}║
║    限速: ${(QWEN_CONFIG.maxRpm + " RPM").padEnd(34)}║
║                                                  ║
╚══════════════════════════════════════════════════╝
`);
    process.exit(0);
  }

  // 检查 API Key
  if (!QWEN_CONFIG.apiKey) {
    console.error("❌ 未配置 API Key，请设置 SKILLWASH_API_KEY 环境变量");
    process.exit(1);
  }

  if (args[0] === "--dir") {
    await runBatchMode(args);
  } else {
    await runSingleMode(args[0]);
  }
}

// ============================================================================
// 单技能模式
// ============================================================================

async function runSingleMode(filePath: string) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 文件不存在: ${filePath}`);
    process.exit(1);
  }
  await washSingleSkill(filePath);
}

// ============================================================================
// 批量模式 (并发 + 断点续跑 + 报告生成)
// ============================================================================

async function runBatchMode(args: string[]) {
  const dirPath = args[1];
  if (!dirPath || !fs.existsSync(dirPath)) {
    console.error(`❌ 目录不存在: ${dirPath}`);
    process.exit(1);
  }

  // 扫描 SKILL.md 文件
  const skillDirs = fs.readdirSync(dirPath, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => path.join(dirPath, d.name, "SKILL.md"))
    .filter(f => fs.existsSync(f));

  const total = skillDirs.length;
  console.log(`\n🔍 发现 ${total} 个技能待清洗`);
  console.log(`   并发: ${QWEN_CONFIG.concurrency} | 限速: ${QWEN_CONFIG.maxRpm} RPM | Checkpoint: 每 ${CHECKPOINT_CONFIG.intervalSkills} 个\n`);

  // 加载 checkpoint（如果 --resume）
  const resumeIdx = args.indexOf("--resume");
  let checkpoint: Checkpoint | null = null;
  const processedIds = new Set<string>();
  const previousResults: PipelineResult[] = [];

  if (resumeIdx !== -1) {
    const cpPath = args[resumeIdx + 1] || path.join(OUTPUT_DIR, CHECKPOINT_CONFIG.filename);
    checkpoint = loadCheckpoint(cpPath);
    if (checkpoint) {
      for (const id of checkpoint.completedSkillIds) processedIds.add(id);
      previousResults.push(...checkpoint.results);
      console.log(`   📂 从 checkpoint 恢复: ${processedIds.size} 个已处理\n`);
    }
  }

  // 过滤已处理的
  const pendingPaths = skillDirs.filter(p => {
    const id = path.basename(path.dirname(p));
    return !processedIds.has(id);
  });

  if (pendingPaths.length === 0) {
    console.log("   ✅ 所有技能已处理完毕（来自 checkpoint）\n");
    return;
  }

  console.log(`   待处理: ${pendingPaths.length} 个\n`);
  console.log("─".repeat(60));

  // 并发执行
  const batchStartTime = Date.now();
  let completed = previousResults.length;
  const allResults: PipelineResult[] = [...previousResults];

  const tasks = pendingPaths.map((skillPath) => async (): Promise<PipelineResult> => {
    const id = path.basename(path.dirname(skillPath));
    try {
      const result = await washSingleSkill(skillPath, { quiet: true });
      completed++;
      const pct = ((completed / total) * 100).toFixed(0);
      const tierStr = result.finalTier ? ` (${result.finalTier})` : "";
      console.log(`  [${String(completed).padStart(4)}/${total}] ${pct.padStart(3)}% | ${id.padEnd(30)} → ${result.finalDecision}${tierStr}`);
      return result;
    } catch (err) {
      completed++;
      console.error(`  [${String(completed).padStart(4)}/${total}]       | ${id.padEnd(30)} → ERROR: ${(err as Error).message}`);
      return {
        skillId: id,
        filePath: skillPath,
        layer1: { skillId: id, passed: false, decision: "reject", structural: [], patternMatches: [], blacklistHits: [], processingTimeMs: 0 },
        finalDecision: "error",
        rejectReason: (err as Error).message,
        totalTimeMs: 0,
      };
    }
  });

  const batchResults = await runConcurrent(tasks, QWEN_CONFIG.concurrency, {
    checkpointInterval: CHECKPOINT_CONFIG.intervalSkills,
    onCheckpoint: (partial) => {
      const merged = [...previousResults, ...partial];
      saveCheckpoint(merged);
    },
  });

  allResults.push(...batchResults);

  // 汇总
  const batchMs = Date.now() - batchStartTime;
  const accepted = allResults.filter(r => r.finalDecision === "accepted");
  const rejected = allResults.filter(r => r.finalDecision === "rejected");
  const review = allResults.filter(r => r.finalDecision === "review");
  const errors = allResults.filter(r => r.finalDecision === "error");

  console.log("\n" + "═".repeat(60));
  console.log("📊 批量清洗汇总");
  console.log("═".repeat(60));
  console.log(`  总数: ${allResults.length}`);
  console.log(`  ✅ 收录: ${accepted.length}`);
  console.log(`  ❌ 淘汰: ${rejected.length}`);
  console.log(`  ⚠️  复审: ${review.length}`);
  if (errors.length > 0) console.log(`  💥 错误: ${errors.length}`);
  console.log(`  ⏱️  耗时: ${(batchMs / 1000).toFixed(1)}s`);
  console.log("═".repeat(60));

  // 生成聚合报告
  console.log("\n📝 生成报告...");
  const dateStr = new Date().toISOString().split("T")[0];
  await generateBatchReports(allResults, dateStr);

  // 清理 checkpoint（全部完成后）
  const cpPath = path.join(path.resolve(OUTPUT_DIR), CHECKPOINT_CONFIG.filename);
  if (fs.existsSync(cpPath)) {
    fs.unlinkSync(cpPath);
    console.log(`  🗑️  已清理 checkpoint 文件`);
  }

  console.log("\n✅ 完成");
}

// ============================================================================
// 并发执行器 (工作池模式)
// ============================================================================

async function runConcurrent<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
  opts?: {
    checkpointInterval?: number;
    onCheckpoint?: (results: T[]) => void;
  },
): Promise<T[]> {
  if (tasks.length === 0) return [];

  const resolvedLimit = Math.max(1, Math.min(limit, tasks.length));
  const results: (T | undefined)[] = new Array(tasks.length);
  let nextIndex = 0;
  let completedCount = 0;

  const workers = Array.from({ length: resolvedLimit }, async () => {
    while (true) {
      const idx = nextIndex++;
      if (idx >= tasks.length) return;

      results[idx] = await tasks[idx]();
      completedCount++;

      // Checkpoint
      if (
        opts?.checkpointInterval &&
        opts.onCheckpoint &&
        completedCount % opts.checkpointInterval === 0
      ) {
        opts.onCheckpoint(results.filter((r): r is T => r !== undefined));
      }
    }
  });

  await Promise.allSettled(workers);
  return results.filter((r): r is T => r !== undefined);
}

// ============================================================================
// Checkpoint 读写
// ============================================================================

function loadCheckpoint(filePath: string): Checkpoint | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (!data.completedSkillIds || !data.results) return null;
    return data as Checkpoint;
  } catch {
    console.warn(`  ⚠ 无法加载 checkpoint: ${filePath}`);
    return null;
  }
}

function saveCheckpoint(results: PipelineResult[]): void {
  const cpDir = path.resolve(OUTPUT_DIR);
  fs.mkdirSync(cpDir, { recursive: true });

  const cp: Checkpoint = {
    pipelineId: `wash-${Date.now()}`,
    startedAt: new Date().toISOString(),
    completedSkillIds: results.map(r => r.skillId),
    results,
  };

  // 原子写入: 先写 .tmp 再 rename
  const cpPath = path.join(cpDir, CHECKPOINT_CONFIG.filename);
  const tmpPath = cpPath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(cp, null, 2), "utf-8");
  fs.renameSync(tmpPath, cpPath);
  console.log(`  💾 Checkpoint 已保存 (${results.length} 个)`);
}

// ============================================================================
// 启动
// ============================================================================

main().catch((err) => {
  console.error("💥 Pipeline 异常:", err);
  process.exit(1);
});
