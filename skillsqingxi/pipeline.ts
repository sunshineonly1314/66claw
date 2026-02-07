/**
 * SkillWash Pipeline — 清洗流水线编排
 */

import fs from "node:fs";
import path from "node:path";
import { runLayer1 } from "./layer1-rules.js";
import { runLayer2 } from "./layer2-security.js";
import { runLayer3 } from "./layer3-quality.js";
import { OUTPUT_DIR, LAYER3_THRESHOLDS } from "./config.js";
import type { SkillInput, PipelineResult } from "./types.js";

// ============================================================================
// SKILL.md 解析
// ============================================================================

export function parseSkillMd(filePath: string): SkillInput {
  const rawContent = fs.readFileSync(filePath, "utf-8");
  const skillId = path.basename(path.dirname(filePath));

  // 解析 frontmatter
  const fmMatch = rawContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!fmMatch) {
    return {
      skillId,
      filePath,
      rawContent,
      frontmatter: { name: skillId, description: "" },
      body: rawContent,
    };
  }

  const fmRaw = fmMatch[1];
  const body = fmMatch[2];

  // 简单 YAML 解析（不引入额外依赖）
  const fm: Record<string, string> = {};
  for (const line of fmRaw.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim();
      let value = line.substring(colonIdx + 1).trim();
      // 去掉引号
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      fm[key] = value;
    }
  }

  // 解析 metadata JSON
  let metadata: Record<string, unknown> | undefined;
  if (fm.metadata) {
    try {
      metadata = JSON.parse(fm.metadata);
    } catch {
      // metadata 可能跨行，尝试从原始 frontmatter 提取
      const metaMatch = fmRaw.match(/metadata:\s*({[\s\S]*})\s*$/m);
      if (metaMatch) {
        try { metadata = JSON.parse(metaMatch[1]); } catch { /* ignore */ }
      }
    }
  }

  return {
    skillId,
    filePath,
    rawContent,
    frontmatter: {
      name: fm.name ?? skillId,
      description: fm.description ?? "",
      homepage: fm.homepage,
      metadata,
    },
    body,
  };
}

// ============================================================================
// 结果格式化
// ============================================================================

function formatDecision(d: string): string {
  switch (d) {
    case "pass": return "✅ 通过";
    case "reject": return "❌ 拒绝";
    case "review": return "⚠️ 复审";
    case "accepted": return "✅ 收录";
    case "rejected": return "❌ 淘汰";
    default: return d;
  }
}

// ============================================================================
// 单个 Skill 清洗
// ============================================================================

export async function washSingleSkill(filePath: string): Promise<PipelineResult> {
  const totalStart = Date.now();

  console.log("═".repeat(60));
  console.log(`🧹 SkillWash Pipeline — 开始清洗`);
  console.log(`📄 文件: ${filePath}`);
  console.log("═".repeat(60));

  // 0. 解析 SKILL.md
  const input = parseSkillMd(filePath);
  console.log(`\n📋 技能信息:`);
  console.log(`   ID: ${input.skillId}`);
  console.log(`   Name: ${input.frontmatter.name}`);
  console.log(`   Description: ${input.frontmatter.description.substring(0, 80)}...`);
  console.log(`   Body: ${input.body.split("\n").length} 行, ${input.rawContent.length} 字符`);

  // 1. Layer 1: 规则引擎
  console.log(`\n${"─".repeat(60)}`);
  console.log(`🔍 Layer 1: 规则引擎`);
  const l1 = runLayer1(input);

  console.log(`   结构校验: ${l1.structural.length === 0 ? "✅ 通过" : `⚠ ${l1.structural.length} 个问题`}`);
  for (const v of l1.structural) {
    console.log(`     [${v.severity}] ${v.message}`);
  }

  console.log(`   模式检测: ${l1.patternMatches.length === 0 ? "✅ 未发现危险模式" : `⚠ ${l1.patternMatches.length} 个匹配`}`);
  for (const m of l1.patternMatches) {
    console.log(`     [${m.severity}] ${m.patternId}: ${m.description} (L${m.lineNumber}${m.inCodeBlock ? " 代码块内" : ""})`);
  }

  if (l1.blacklistHits.length > 0) {
    console.log(`   黑名单: ❌ 命中 ${l1.blacklistHits.join(", ")}`);
  }

  console.log(`   判定: ${formatDecision(l1.decision)} (${l1.processingTimeMs}ms)`);

  if (l1.decision === "reject") {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`❌ 清洗结果: 被 Layer 1 拒绝`);
    console.log(`${"═".repeat(60)}`);
    return {
      skillId: input.skillId,
      filePath,
      layer1: l1,
      finalDecision: "rejected",
      rejectReason: `Layer1: ${l1.patternMatches.map((m) => m.description).join("; ") || l1.structural.map((v) => v.message).join("; ") || l1.blacklistHits.join(", ")}`,
      totalTimeMs: Date.now() - totalStart,
    };
  }

  // 2. Layer 2: 安全审计 (Qwen-Max)
  console.log(`\n${"─".repeat(60)}`);
  console.log(`🛡️ Layer 2: Qwen-Max 安全审计`);
  console.log(`   调用 Qwen API 中...`);
  const l2 = await runLayer2(input, l1.decision as "pass" | "review");

  console.log(`   风险等级: ${l2.riskLevel}`);
  console.log(`   置信度: ${(l2.confidence * 100).toFixed(0)}%`);
  console.log(`   发现问题: ${l2.issues.length} 个`);
  for (const issue of l2.issues) {
    console.log(`     [${issue.severity}] ${issue.category}: ${issue.description}`);
  }
  if (l2.hiddenRisks) {
    console.log(`   隐蔽风险: ${l2.hiddenRisks}`);
  }
  console.log(`   结论: ${l2.summary}`);
  console.log(`   判定: ${formatDecision(l2.decision)} (${l2.processingTimeMs}ms, ${l2.inputTokens}+${l2.outputTokens} tokens)`);

  if (l2.decision === "reject") {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`❌ 清洗结果: 被 Layer 2 拒绝 — ${l2.summary}`);
    console.log(`${"═".repeat(60)}`);
    return {
      skillId: input.skillId,
      filePath,
      layer1: l1,
      layer2: l2,
      finalDecision: "rejected",
      rejectReason: `Layer2: ${l2.summary}`,
      totalTimeMs: Date.now() - totalStart,
    };
  }

  if (l2.decision === "review") {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`⚠️ 清洗结果: 需要人工复审 — ${l2.summary}`);
    console.log(`${"═".repeat(60)}`);
    return {
      skillId: input.skillId,
      filePath,
      layer1: l1,
      layer2: l2,
      finalDecision: "review",
      rejectReason: `Layer2 review: ${l2.summary}`,
      totalTimeMs: Date.now() - totalStart,
    };
  }

  // 3. Layer 3: 质量评估 + 汉化
  console.log(`\n${"─".repeat(60)}`);
  console.log(`📊 Layer 3: 质量评估 + 汉化`);
  const l3 = await runLayer3(input);

  console.log(`\n   评分明细:`);
  console.log(`     实用性: ${l3.quality.scores.utility}/10`);
  console.log(`     完整度: ${l3.quality.scores.completeness}/10`);
  console.log(`     技术质量: ${l3.quality.scores.technicalQuality}/10`);
  console.log(`     维护状态: ${l3.quality.scores.maintenance}/10`);
  console.log(`     CN适配: ${l3.quality.scores.cnCompatibility}/10`);
  console.log(`   综合评分: ${l3.quality.overallScore.toFixed(1)} (${l3.quality.tier} 级)`);
  console.log(`   分类: ${l3.quality.category}`);
  console.log(`   标签: ${l3.quality.tags.join(", ")}`);
  console.log(`   亮点: ${l3.quality.highlights}`);
  console.log(`   不足: ${l3.quality.weaknesses}`);
  console.log(`   总评: ${l3.quality.summary}`);
  console.log(`   CN 被墙: ${l3.quality.cnBlocked ? "是" : "否"}`);
  if (l3.quality.cnAlternative) {
    console.log(`   国内替代: ${l3.quality.cnAlternative}`);
  }

  if (l3.translation) {
    console.log(`   翻译: ${l3.translation.validationPassed ? "✅ 验证通过" : "⚠ 验证未通过"}`);
  }

  console.log(`   (${l3.processingTimeMs}ms, ${l3.totalTokens} tokens)`);

  // 4. 最终判定
  const isAccepted = l3.quality.overallScore >= LAYER3_THRESHOLDS.minOverallScore;
  let finalTier: "S" | "A" | "B" | undefined;
  if (isAccepted) {
    finalTier = l3.quality.tier as "S" | "A" | "B";
  }

  console.log(`\n${"═".repeat(60)}`);
  if (isAccepted) {
    console.log(`✅ 清洗结果: 收录 (${l3.quality.tier} 级, ${l3.quality.overallScore.toFixed(1)}分)`);
  } else {
    console.log(`❌ 清洗结果: 质量不达标 (${l3.quality.overallScore.toFixed(1)}分 < 5.0)`);
  }
  console.log(`   总耗时: ${((Date.now() - totalStart) / 1000).toFixed(1)}s`);
  console.log(`${"═".repeat(60)}`);

  // 5. 保存输出
  const result: PipelineResult = {
    skillId: input.skillId,
    filePath,
    layer1: l1,
    layer2: l2,
    layer3: l3,
    finalDecision: isAccepted ? "accepted" : "rejected",
    finalTier,
    rejectReason: isAccepted ? undefined : `质量评分 ${l3.quality.overallScore.toFixed(1)} 低于 5.0`,
    totalTimeMs: Date.now() - totalStart,
  };

  // 保存报告
  await saveReport(result, l3.translation?.translatedContent);

  return result;
}

// ============================================================================
// 保存清洗报告
// ============================================================================

async function saveReport(result: PipelineResult, translatedContent?: string): Promise<void> {
  const outputDir = path.resolve(OUTPUT_DIR);
  const reportDir = path.join(outputDir, "report");
  const skillsZhDir = path.join(outputDir, "skills-zh", result.skillId);
  const skillsEnDir = path.join(outputDir, "skills-en", result.skillId);

  // 创建目录
  fs.mkdirSync(reportDir, { recursive: true });

  // 保存审计报告
  const reportPath = path.join(reportDir, `${result.skillId}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(`\n📁 审计报告: ${reportPath}`);

  // 如果收录，保存英文原版
  if (result.finalDecision === "accepted") {
    fs.mkdirSync(skillsEnDir, { recursive: true });
    const originalContent = fs.readFileSync(result.filePath, "utf-8");
    fs.writeFileSync(path.join(skillsEnDir, "SKILL.md"), originalContent, "utf-8");
    console.log(`📁 英文原版: ${skillsEnDir}/SKILL.md`);

    // 保存中文翻译
    if (translatedContent && result.layer3?.translation?.validationPassed) {
      fs.mkdirSync(skillsZhDir, { recursive: true });
      fs.writeFileSync(path.join(skillsZhDir, "SKILL.md"), translatedContent, "utf-8");
      console.log(`📁 中文翻译: ${skillsZhDir}/SKILL.md`);
    }
  }
}
