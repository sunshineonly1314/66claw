/**
 * 批量 SkillWash - 300个/批次，支持断点续传和迭代优化
 *
 * 用法:
 *   npx tsx cn/skills-qc/batch-wash.ts --batch 1       # 清洗第 1 批（1-300）
 *   npx tsx cn/skills-qc/batch-wash.ts --batch 2       # 清洗第 2 批（301-600）
 *   npx tsx cn/skills-qc/batch-wash.ts --resume        # 从上次中断处继续
 *   npx tsx cn/skills-qc/batch-wash.ts --review 1      # Review 第 1 批结果
 *   npx tsx cn/skills-qc/batch-wash.ts --restore skill-name  # 将误判技能恢复到 accepted
 */

import fs from "node:fs";
import path from "node:path";
import { washBatch, generateBatchReports } from "./pipeline.js";
import { OUTPUT_DIR } from "./config.js";
import type { SkillInput, PipelineResult, BatchStats } from "./types.js";

// ============================================================================
// 配置
// ============================================================================

const BATCH_CONFIG = {
  sourceDir: "./skills-awesome",           // awesome 下载目录
  outputDir: "./cn/skills-qc/output-batch", // 批量输出目录
  batchSize: 300,                          // 每批 300 个
  checkpointFile: "./cn/skills-qc/output-batch/checkpoint.json",
  reviewDir: "./cn/skills-qc/output-batch/review", // review 标注目录
};

interface Checkpoint {
  lastBatch: number;
  lastSkillIndex: number;
  totalSkills: number;
  processedSkills: number;
  timestamp: string;
}

interface ReviewAnnotation {
  skillName: string;
  batch: number;
  decision: "accepted" | "rejected";
  actualDecision: "should_accept" | "should_reject"; // 人工标注
  reason: string;
  layer: 1 | 2 | 3;
  timestamp: string;
}

// ============================================================================
// 扫描 skills-awesome 目录
// ============================================================================

function scanAwesomeSkills(): SkillInput[] {
  const skills: SkillInput[] = [];

  if (!fs.existsSync(BATCH_CONFIG.sourceDir)) {
    throw new Error(`源目录不存在: ${BATCH_CONFIG.sourceDir}`);
  }

  const entries = fs.readdirSync(BATCH_CONFIG.sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillPath = path.join(BATCH_CONFIG.sourceDir, entry.name);
    const skillMdPath = path.join(skillPath, "SKILL.md");

    if (!fs.existsSync(skillMdPath)) {
      console.warn(`  ⚠️  跳过 ${entry.name}: SKILL.md 不存在`);
      continue;
    }

    skills.push({
      name: entry.name,
      path: skillPath,
    });
  }

  console.log(`📂 扫描到 ${skills.length} 个技能`);
  return skills;
}

// ============================================================================
// Checkpoint 管理
// ============================================================================

function loadCheckpoint(): Checkpoint | null {
  if (!fs.existsSync(BATCH_CONFIG.checkpointFile)) return null;
  try {
    const raw = fs.readFileSync(BATCH_CONFIG.checkpointFile, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveCheckpoint(checkpoint: Checkpoint): void {
  fs.mkdirSync(path.dirname(BATCH_CONFIG.checkpointFile), { recursive: true });
  fs.writeFileSync(
    BATCH_CONFIG.checkpointFile,
    JSON.stringify(checkpoint, null, 2),
    "utf-8",
  );
}

// ============================================================================
// 批量清洗
// ============================================================================

async function washBatchN(batchNum: number, skills: SkillInput[]): Promise<void> {
  const startIdx = (batchNum - 1) * BATCH_CONFIG.batchSize;
  const endIdx = Math.min(startIdx + BATCH_CONFIG.batchSize, skills.length);

  if (startIdx >= skills.length) {
    console.log(`❌ 批次 ${batchNum} 超出范围（总共 ${skills.length} 个技能）`);
    return;
  }

  const batchSkills = skills.slice(startIdx, endIdx);

  console.log("═".repeat(60));
  console.log(`🚀 批次 ${batchNum}: 清洗 ${startIdx + 1}-${endIdx} (${batchSkills.length} 个)`);
  console.log("═".repeat(60));

  // 设置输出目录为批次专用目录
  const batchOutputDir = path.join(BATCH_CONFIG.outputDir, `batch-${batchNum}`);

  // 运行清洗
  const results = await washBatch(batchSkills);

  // 生成报告（传入自定义输出目录）
  generateBatchReports(results, batchSkills.length);

  // 保存 checkpoint
  const checkpoint: Checkpoint = {
    lastBatch: batchNum,
    lastSkillIndex: endIdx,
    totalSkills: skills.length,
    processedSkills: endIdx,
    timestamp: new Date().toISOString(),
  };
  saveCheckpoint(checkpoint);

  console.log(`\n✅ 批次 ${batchNum} 完成，checkpoint 已保存`);
}

// ============================================================================
// Review 批次结果
// ============================================================================

function reviewBatch(batchNum: number): void {
  const batchDir = path.join(BATCH_CONFIG.outputDir, `batch-${batchNum}`);
  const indexPath = path.join(batchDir, "skills-index.json");

  if (!fs.existsSync(indexPath)) {
    console.log(`❌ 批次 ${batchNum} 的索引文件不存在: ${indexPath}`);
    return;
  }

  const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));

  console.log("═".repeat(60));
  console.log(`📊 批次 ${batchNum} Review`);
  console.log("═".repeat(60));

  console.log(`\n总扫描: ${index.stats.totalScanned}`);
  console.log(`收录数: ${index.stats.finalAccepted}`);
  console.log(`拒绝数: ${index.stats.totalScanned - index.stats.finalAccepted}`);

  // 显示拒绝原因分布
  const rejectedReasons: Record<string, string[]> = {
    layer1: [],
    layer2: [],
    layer3: [],
  };

  const reportDir = path.join(batchDir, "report");
  if (fs.existsSync(reportDir)) {
    const reports = fs.readdirSync(reportDir).filter(f => f.endsWith(".json"));

    for (const reportFile of reports) {
      const report = JSON.parse(fs.readFileSync(path.join(reportDir, reportFile), "utf-8"));

      if (!report.layer1.pass) {
        rejectedReasons.layer1.push(`${report.skillName}: ${report.layer1.violations.join(", ")}`);
      } else if (!report.layer2.pass) {
        rejectedReasons.layer2.push(`${report.skillName}: ${report.layer2.recommendation}`);
      } else if (!report.layer3.pass) {
        rejectedReasons.layer3.push(`${report.skillName}: Overall ${report.layer3.quality.scores.overall}`);
      }
    }
  }

  console.log(`\n🚫 Layer1 拒绝 (${rejectedReasons.layer1.length}):`);
  rejectedReasons.layer1.slice(0, 10).forEach(r => console.log(`  - ${r}`));
  if (rejectedReasons.layer1.length > 10) {
    console.log(`  ... 还有 ${rejectedReasons.layer1.length - 10} 个`);
  }

  console.log(`\n🚫 Layer2 拒绝 (${rejectedReasons.layer2.length}):`);
  rejectedReasons.layer2.slice(0, 10).forEach(r => console.log(`  - ${r}`));
  if (rejectedReasons.layer2.length > 10) {
    console.log(`  ... 还有 ${rejectedReasons.layer2.length - 10} 个`);
  }

  console.log(`\n🚫 Layer3 拒绝 (${rejectedReasons.layer3.length}):`);
  rejectedReasons.layer3.slice(0, 10).forEach(r => console.log(`  - ${r}`));
  if (rejectedReasons.layer3.length > 10) {
    console.log(`  ... 还有 ${rejectedReasons.layer3.length - 10} 个`);
  }

  console.log(`\n💡 Review 提示:`);
  console.log(`   1. 检查拒绝理由是否合理`);
  console.log(`   2. 如果发现误判，使用 --restore <skill-name> 恢复`);
  console.log(`   3. 记录误判模式，优化 Layer1/2/3 提示词`);
}

// ============================================================================
// 恢复误判技能
// ============================================================================

function restoreSkill(skillName: string): void {
  console.log(`🔄 恢复技能: ${skillName}`);

  // 1. 在所有批次中查找该技能
  const batches = fs.readdirSync(BATCH_CONFIG.outputDir).filter(d => d.startsWith("batch-"));

  let found = false;
  for (const batchDir of batches) {
    const reportPath = path.join(BATCH_CONFIG.outputDir, batchDir, "report", `${skillName}.json`);

    if (fs.existsSync(reportPath)) {
      found = true;
      const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));

      // 2. 创建 review annotation
      const annotation: ReviewAnnotation = {
        skillName,
        batch: parseInt(batchDir.replace("batch-", "")),
        decision: "rejected",
        actualDecision: "should_accept",
        reason: "Manual review: false positive",
        layer: !report.layer1.pass ? 1 : !report.layer2.pass ? 2 : 3,
        timestamp: new Date().toISOString(),
      };

      fs.mkdirSync(BATCH_CONFIG.reviewDir, { recursive: true });
      const annotationPath = path.join(BATCH_CONFIG.reviewDir, `${skillName}.json`);
      fs.writeFileSync(annotationPath, JSON.stringify(annotation, null, 2), "utf-8");

      console.log(`✅ 已标记为误判，保存到: ${annotationPath}`);
      console.log(`   Layer: ${annotation.layer}`);
      console.log(`   原因: ${annotation.reason}`);

      break;
    }
  }

  if (!found) {
    console.log(`❌ 未找到技能: ${skillName}`);
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
║  SkillWash 批量清洗 - 300个/批次                        ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  用法:                                                   ║
║    npx tsx cn/skills-qc/batch-wash.ts --batch N         ║
║    npx tsx cn/skills-qc/batch-wash.ts --resume          ║
║    npx tsx cn/skills-qc/batch-wash.ts --review N        ║
║    npx tsx cn/skills-qc/batch-wash.ts --restore <name>  ║
║                                                          ║
║  示例:                                                   ║
║    --batch 1      清洗第 1 批（1-300）                  ║
║    --batch 2      清洗第 2 批（301-600）                ║
║    --resume       从上次中断处继续                       ║
║    --review 1     Review 第 1 批结果                     ║
║    --restore xxx  将误判技能恢复到 accepted              ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`);
    return;
  }

  // 扫描所有技能
  const allSkills = scanAwesomeSkills();

  // --batch N
  const batchIdx = args.indexOf("--batch");
  if (batchIdx !== -1) {
    const batchNum = parseInt(args[batchIdx + 1]);
    if (isNaN(batchNum) || batchNum < 1) {
      console.error("❌ 批次号必须是正整数");
      process.exit(1);
    }
    await washBatchN(batchNum, allSkills);
    return;
  }

  // --resume
  if (args.includes("--resume")) {
    const checkpoint = loadCheckpoint();
    if (!checkpoint) {
      console.log("❌ 没有找到 checkpoint，请使用 --batch 1 开始");
      process.exit(1);
    }
    console.log(`📍 从 checkpoint 继续: 批次 ${checkpoint.lastBatch + 1}`);
    await washBatchN(checkpoint.lastBatch + 1, allSkills);
    return;
  }

  // --review N
  const reviewIdx = args.indexOf("--review");
  if (reviewIdx !== -1) {
    const batchNum = parseInt(args[reviewIdx + 1]);
    reviewBatch(batchNum);
    return;
  }

  // --restore <name>
  const restoreIdx = args.indexOf("--restore");
  if (restoreIdx !== -1) {
    const skillName = args[restoreIdx + 1];
    if (!skillName) {
      console.error("❌ 请提供技能名称");
      process.exit(1);
    }
    restoreSkill(skillName);
    return;
  }

  // 默认: 显示帮助
  console.log("使用 --help 查看帮助");
}

main().catch((err) => {
  console.error("💥 批量清洗异常:", err);
  process.exit(1);
});
