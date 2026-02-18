/**
 * 提示词优化器 - 基于 review 标注自动优化 Layer1/2/3 提示词
 *
 * 用法:
 *   npx tsx cn/skills-qc/optimize-prompts.ts --analyze    # 分析误判模式
 *   npx tsx cn/skills-qc/optimize-prompts.ts --suggest    # 生成优化建议
 */

import fs from "node:fs";
import path from "node:path";
import type { ReviewAnnotation } from "./batch-wash.js";

const REVIEW_DIR = "./cn/skills-qc/output-batch/review";

interface MisclassificationPattern {
  layer: 1 | 2 | 3;
  count: number;
  examples: Array<{
    skillName: string;
    reason: string;
    actualDecision: string;
  }>;
}

// ============================================================================
// 分析误判模式
// ============================================================================

function analyzeMisclassifications(): void {
  if (!fs.existsSync(REVIEW_DIR)) {
    console.log("❌ Review 目录不存在，请先使用 --restore 标注误判案例");
    return;
  }

  const annotations = fs.readdirSync(REVIEW_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => JSON.parse(fs.readFileSync(path.join(REVIEW_DIR, f), "utf-8")) as ReviewAnnotation);

  console.log("═".repeat(60));
  console.log(`📊 误判分析 (总计 ${annotations.length} 个)`);
  console.log("═".repeat(60));

  // 按 layer 分组
  const byLayer: Record<number, ReviewAnnotation[]> = {
    1: [],
    2: [],
    3: [],
  };

  for (const ann of annotations) {
    byLayer[ann.layer].push(ann);
  }

  // Layer 1 误判
  console.log(`\n🔴 Layer1 误判 (${byLayer[1].length} 个):`);
  if (byLayer[1].length > 0) {
    console.log("   常见模式:");
    const layer1Reasons = new Map<string, number>();
    for (const ann of byLayer[1]) {
      const key = ann.reason;
      layer1Reasons.set(key, (layer1Reasons.get(key) || 0) + 1);
    }
    for (const [reason, count] of Array.from(layer1Reasons.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`     - ${reason} (${count} 次)`);
    }

    console.log("\n   示例技能:");
    byLayer[1].slice(0, 5).forEach(ann => {
      console.log(`     - ${ann.skillName}: ${ann.reason}`);
    });
  }

  // Layer 2 误判
  console.log(`\n🟡 Layer2 误判 (${byLayer[2].length} 个):`);
  if (byLayer[2].length > 0) {
    console.log("   常见模式:");
    const layer2Reasons = new Map<string, number>();
    for (const ann of byLayer[2]) {
      const key = ann.reason;
      layer2Reasons.set(key, (layer2Reasons.get(key) || 0) + 1);
    }
    for (const [reason, count] of Array.from(layer2Reasons.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`     - ${reason} (${count} 次)`);
    }

    console.log("\n   示例技能:");
    byLayer[2].slice(0, 5).forEach(ann => {
      console.log(`     - ${ann.skillName}: ${ann.reason}`);
    });
  }

  // Layer 3 误判
  console.log(`\n🟢 Layer3 误判 (${byLayer[3].length} 个):`);
  if (byLayer[3].length > 0) {
    console.log("   常见模式:");
    const layer3Reasons = new Map<string, number>();
    for (const ann of byLayer[3]) {
      const key = ann.reason;
      layer3Reasons.set(key, (layer3Reasons.get(key) || 0) + 1);
    }
    for (const [reason, count] of Array.from(layer3Reasons.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`     - ${reason} (${count} 次)`);
    }

    console.log("\n   示例技能:");
    byLayer[3].slice(0, 5).forEach(ann => {
      console.log(`     - ${ann.skillName}: ${ann.reason}`);
    });
  }
}

// ============================================================================
// 生成优化建议
// ============================================================================

function suggestOptimizations(): void {
  if (!fs.existsSync(REVIEW_DIR)) {
    console.log("❌ Review 目录不存在，请先使用 --restore 标注误判案例");
    return;
  }

  const annotations = fs.readdirSync(REVIEW_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => JSON.parse(fs.readFileSync(path.join(REVIEW_DIR, f), "utf-8")) as ReviewAnnotation);

  console.log("═".repeat(60));
  console.log(`💡 提示词优化建议`);
  console.log("═".repeat(60));

  // 按 layer 分组
  const byLayer: Record<number, ReviewAnnotation[]> = {
    1: [],
    2: [],
    3: [],
  };

  for (const ann of annotations) {
    byLayer[ann.layer].push(ann);
  }

  // Layer 1 优化建议
  if (byLayer[1].length > 0) {
    console.log(`\n📝 Layer1 优化建议 (基于 ${byLayer[1].length} 个误判):`);
    console.log("   当前规则可能过于严格，建议放宽以下规则:");

    const layer1Reasons = new Map<string, number>();
    for (const ann of byLayer[1]) {
      const key = ann.reason;
      layer1Reasons.set(key, (layer1Reasons.get(key) || 0) + 1);
    }

    for (const [reason, count] of Array.from(layer1Reasons.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3)) {
      console.log(`     ${count}. ${reason}`);
      console.log(`        建议: 添加例外条件或放宽阈值`);
    }
  }

  // Layer 2 优化建议
  if (byLayer[2].length > 0) {
    console.log(`\n📝 Layer2 优化建议 (基于 ${byLayer[2].length} 个误判):`);
    console.log("   安全判定可能存在假阳性，建议调整:");

    const layer2Reasons = new Map<string, number>();
    for (const ann of byLayer[2]) {
      const key = ann.reason;
      layer2Reasons.set(key, (layer2Reasons.get(key) || 0) + 1);
    }

    for (const [reason, count] of Array.from(layer2Reasons.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3)) {
      console.log(`     ${count}. ${reason}`);
      console.log(`        建议: 在 SYSTEM_PROMPT 中添加此类案例的判定指导`);
    }
  }

  // Layer 3 优化建议
  if (byLayer[3].length > 0) {
    console.log(`\n📝 Layer3 优化建议 (基于 ${byLayer[3].length} 个误判):`);
    console.log("   质量评分可能过于保守，建议:");

    const layer3Reasons = new Map<string, number>();
    for (const ann of byLayer[3]) {
      const key = ann.reason;
      layer3Reasons.set(key, (layer3Reasons.get(key) || 0) + 1);
    }

    for (const [reason, count] of Array.from(layer3Reasons.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3)) {
      console.log(`     ${count}. ${reason}`);
      console.log(`        建议: 调整 overallScore 计算权重或降低阈值`);
    }
  }

  console.log(`\n🎯 下一步操作:`);
  console.log(`   1. 根据建议修改 cn/skills-qc/layer1-rules.ts`);
  console.log(`   2. 根据建议修改 cn/skills-qc/layer2-security.ts SYSTEM_PROMPT`);
  console.log(`   3. 根据建议修改 cn/skills-qc/layer3-quality.ts 评分逻辑`);
  console.log(`   4. 重新运行下一批次验证改进效果`);
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  提示词优化器 - 基于误判案例自动优化                    ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  用法:                                                   ║
║    npx tsx cn/skills-qc/optimize-prompts.ts --analyze   ║
║    npx tsx cn/skills-qc/optimize-prompts.ts --suggest   ║
║                                                          ║
║  说明:                                                   ║
║    --analyze    分析误判模式和分布                       ║
║    --suggest    生成提示词优化建议                       ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`);
    return;
  }

  if (args.includes("--analyze")) {
    analyzeMisclassifications();
    return;
  }

  if (args.includes("--suggest")) {
    suggestOptimizations();
    return;
  }

  console.log("使用 --help 查看帮助");
}

main().catch((err) => {
  console.error("💥 优化器异常:", err);
  process.exit(1);
});
