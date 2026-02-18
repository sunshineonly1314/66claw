/**
 * SkillWash Pipeline — 清洗流水线编排 + 聚合报告生成
 */

import fs from "node:fs";
import path from "node:path";
import { runLayer1 } from "./layer1-rules.js";
import { runLayer2 } from "./layer2-security.js";
import { runLayer3 } from "./layer3-quality.js";
import { OUTPUT_DIR, LAYER3_THRESHOLDS, REPORT_CONFIG } from "./config.js";
import type { SkillInput, PipelineResult, BatchStats } from "./types.js";

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

export async function washSingleSkill(
  filePath: string,
  options?: { quiet?: boolean },
): Promise<PipelineResult> {
  const totalStart = Date.now();
  const log = options?.quiet ? (..._args: unknown[]) => {} : console.log;

  log("═".repeat(60));
  log(`🧹 SkillWash Pipeline — 开始清洗`);
  log(`📄 文件: ${filePath}`);
  log("═".repeat(60));

  // 0. 解析 SKILL.md
  const input = parseSkillMd(filePath);
  log(`\n📋 技能信息:`);
  log(`   ID: ${input.skillId}`);
  log(`   Name: ${input.frontmatter.name}`);
  log(`   Description: ${input.frontmatter.description.substring(0, 80)}...`);
  log(`   Body: ${input.body.split("\n").length} 行, ${input.rawContent.length} 字符`);

  // 1. Layer 1: 规则引擎
  log(`\n${"─".repeat(60)}`);
  log(`🔍 Layer 1: 规则引擎`);
  const l1 = runLayer1(input);

  log(`   结构校验: ${l1.structural.length === 0 ? "✅ 通过" : `⚠ ${l1.structural.length} 个问题`}`);
  for (const v of l1.structural) {
    log(`     [${v.severity}] ${v.message}`);
  }

  log(`   模式检测: ${l1.patternMatches.length === 0 ? "✅ 未发现危险模式" : `⚠ ${l1.patternMatches.length} 个匹配`}`);
  for (const m of l1.patternMatches) {
    log(`     [${m.severity}] ${m.patternId}: ${m.description} (L${m.lineNumber}${m.inCodeBlock ? " 代码块内" : ""})`);
  }

  if (l1.blacklistHits.length > 0) {
    log(`   黑名单: ❌ 命中 ${l1.blacklistHits.join(", ")}`);
  }

  log(`   判定: ${formatDecision(l1.decision)} (${l1.processingTimeMs}ms)`);

  if (l1.decision === "reject") {
    log(`\n${"═".repeat(60)}`);
    log(`❌ 清洗结果: 被 Layer 1 拒绝`);
    log(`${"═".repeat(60)}`);
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
  log(`\n${"─".repeat(60)}`);
  log(`🛡️ Layer 2: Qwen-Max 安全审计`);
  log(`   调用 Qwen API 中...`);
  const l2 = await runLayer2(input, l1.decision as "pass" | "review");

  log(`   风险等级: ${l2.riskLevel}`);
  log(`   置信度: ${(l2.confidence * 100).toFixed(0)}%`);
  log(`   发现问题: ${l2.issues.length} 个`);
  for (const issue of l2.issues) {
    log(`     [${issue.severity}] ${issue.category}: ${issue.description}`);
  }
  if (l2.hiddenRisks) {
    log(`   隐蔽风险: ${l2.hiddenRisks}`);
  }
  log(`   结论: ${l2.summary}`);
  log(`   判定: ${formatDecision(l2.decision)} (${l2.processingTimeMs}ms, ${l2.inputTokens}+${l2.outputTokens} tokens)`);

  if (l2.decision === "reject") {
    log(`\n${"═".repeat(60)}`);
    log(`❌ 清洗结果: 被 Layer 2 拒绝 — ${l2.summary}`);
    log(`${"═".repeat(60)}`);
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
    log(`\n${"═".repeat(60)}`);
    log(`⚠️ 清洗结果: 需要人工复审 — ${l2.summary}`);
    log(`${"═".repeat(60)}`);
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
  log(`\n${"─".repeat(60)}`);
  log(`📊 Layer 3: 质量评估 + 汉化`);
  const l3 = await runLayer3(input);

  log(`\n   评分明细:`);
  log(`     实用性: ${l3.quality.scores.utility}/10`);
  log(`     完整度: ${l3.quality.scores.completeness}/10`);
  log(`     技术质量: ${l3.quality.scores.technicalQuality}/10`);
  log(`     维护状态: ${l3.quality.scores.maintenance}/10`);
  log(`     CN适配: ${l3.quality.scores.cnCompatibility}/10`);
  log(`   综合评分: ${l3.quality.overallScore.toFixed(1)} (${l3.quality.tier} 级)`);
  log(`   分类: ${l3.quality.category}`);
  log(`   标签: ${l3.quality.tags.join(", ")}`);
  log(`   亮点: ${l3.quality.highlights}`);
  log(`   不足: ${l3.quality.weaknesses}`);
  log(`   总评: ${l3.quality.summary}`);
  log(`   CN 被墙: ${l3.quality.cnBlocked ? "是" : "否"}`);
  if (l3.quality.cnAlternative) {
    log(`   国内替代: ${l3.quality.cnAlternative}`);
  }

  if (l3.translation) {
    log(`   翻译: ${l3.translation.validationPassed ? "✅ 验证通过" : "⚠ 验证未通过"}`);
  }

  log(`   (${l3.processingTimeMs}ms, ${l3.totalTokens} tokens)`);

  // 4. 最终判定
  const isAccepted = l3.quality.overallScore >= LAYER3_THRESHOLDS.minOverallScore;
  let finalTier: "S" | "A" | "B" | undefined;
  if (isAccepted) {
    finalTier = l3.quality.tier as "S" | "A" | "B";
  }

  log(`\n${"═".repeat(60)}`);
  if (isAccepted) {
    log(`✅ 清洗结果: 收录 (${l3.quality.tier} 级, ${l3.quality.overallScore.toFixed(1)}分)`);
  } else {
    log(`❌ 清洗结果: 质量不达标 (${l3.quality.overallScore.toFixed(1)}分 < 5.0)`);
  }
  log(`   总耗时: ${((Date.now() - totalStart) / 1000).toFixed(1)}s`);
  log(`${"═".repeat(60)}`);

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

  // 保存单技能报告
  await saveSkillReport(result, l3.translation?.translatedContent);

  return result;
}

// ============================================================================
// 保存单技能报告
// ============================================================================

async function saveSkillReport(result: PipelineResult, translatedContent?: string): Promise<void> {
  const outputDir = path.resolve(OUTPUT_DIR);
  const reportDir = path.join(outputDir, "report");
  const skillsZhDir = path.join(outputDir, "skills-zh", result.skillId);
  const skillsEnDir = path.join(outputDir, "skills-en", result.skillId);

  // 创建目录
  fs.mkdirSync(reportDir, { recursive: true });

  // 保存审计报告
  const reportPath = path.join(reportDir, `${result.skillId}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), "utf-8");

  // 如果收录，保存英文原版
  if (result.finalDecision === "accepted") {
    fs.mkdirSync(skillsEnDir, { recursive: true });
    const originalContent = fs.readFileSync(result.filePath, "utf-8");
    fs.writeFileSync(path.join(skillsEnDir, "SKILL.md"), originalContent, "utf-8");

    // 保存中文翻译
    if (translatedContent && result.layer3?.translation?.validationPassed) {
      fs.mkdirSync(skillsZhDir, { recursive: true });
      fs.writeFileSync(path.join(skillsZhDir, "SKILL.md"), translatedContent, "utf-8");
    }
  }
}

// ============================================================================
// 聚合报告生成
// ============================================================================

function computeStats(results: PipelineResult[]): BatchStats {
  const accepted = results.filter(r => r.finalDecision === "accepted");
  const rejected = results.filter(r => r.finalDecision === "rejected");
  const review = results.filter(r => r.finalDecision === "review");

  let totalInput = 0;
  let totalOutput = 0;
  const categoryMap: Record<string, number> = {};
  const findings = {
    promptInjection: 0, dataExfil: 0, commandInjection: 0,
    obfuscation: 0, cryptoMining: 0, privilegeEscalation: 0,
  };

  for (const r of results) {
    // Token 统计
    if (r.layer2) {
      totalInput += r.layer2.inputTokens;
      totalOutput += r.layer2.outputTokens;
    }
    if (r.layer3) {
      // layer3.totalTokens 是 input + output 合计，近似拆分
      totalInput += Math.round(r.layer3.totalTokens * 0.4);
      totalOutput += Math.round(r.layer3.totalTokens * 0.6);
    }

    // 分类统计
    if (r.layer3?.quality.category) {
      const cat = r.layer3.quality.category;
      categoryMap[cat] = (categoryMap[cat] ?? 0) + 1;
    }

    // 安全发现统计
    if (r.layer1) {
      for (const m of r.layer1.patternMatches) {
        if (m.category === "prompt_injection") findings.promptInjection++;
        else if (m.category === "data_exfil") findings.dataExfil++;
        else if (m.category === "command_injection") findings.commandInjection++;
        else if (m.category === "obfuscation") findings.obfuscation++;
        else if (m.category === "crypto_mining") findings.cryptoMining++;
        else if (m.category === "privilege_escalation") findings.privilegeEscalation++;
      }
    }
  }

  // Tier 统计
  const tierDist = { S: 0, A: 0, B: 0 };
  for (const r of accepted) {
    if (r.finalTier === "S") tierDist.S++;
    else if (r.finalTier === "A") tierDist.A++;
    else if (r.finalTier === "B") tierDist.B++;
  }

  // 分层淘汰统计
  const l1Rejected = rejected.filter(r => r.rejectReason?.startsWith("Layer1:")).length;
  const l2Rejected = rejected.filter(r => r.rejectReason?.startsWith("Layer2:")).length;
  const l3Excluded = rejected.filter(r => r.rejectReason?.includes("质量评分")).length;

  const estimatedCost =
    (totalInput / 1000 * REPORT_CONFIG.inputTokenPrice) +
    (totalOutput / 1000 * REPORT_CONFIG.outputTokenPrice);

  return {
    totalScanned: results.length,
    layer1Rejected: l1Rejected,
    layer2Rejected: l2Rejected,
    layer2Review: review.length,
    layer3Excluded: l3Excluded,
    finalAccepted: accepted.length,
    tierDistribution: tierDist,
    categoryDistribution: categoryMap,
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    estimatedCostCNY: Math.round(estimatedCost * 100) / 100,
    totalProcessingMs: results.reduce((sum, r) => sum + (r.totalTimeMs ?? 0), 0),
    securityFindings: findings,
  };
}

export async function generateBatchReports(
  results: PipelineResult[],
  dateStr: string,
): Promise<void> {
  const outputDir = path.resolve(OUTPUT_DIR, "report");
  fs.mkdirSync(outputDir, { recursive: true });

  const stats = computeStats(results);

  // 1. 完整 JSON 报告
  const fullReport = {
    stats,
    results,
    generatedAt: new Date().toISOString(),
    pipelineVersion: REPORT_CONFIG.pipelineVersion,
  };
  fs.writeFileSync(
    path.join(outputDir, `wash-report-${dateStr}.json`),
    JSON.stringify(fullReport, null, 2),
    "utf-8",
  );

  // 2. 被拒技能 JSON
  const rejectedList = results
    .filter(r => r.finalDecision === "rejected")
    .map(r => ({ skillId: r.skillId, reason: r.rejectReason }));
  fs.writeFileSync(
    path.join(outputDir, "rejected-skills.json"),
    JSON.stringify(rejectedList, null, 2),
    "utf-8",
  );

  // 3. 复审技能 JSON
  const reviewList = results
    .filter(r => r.finalDecision === "review")
    .map(r => ({ skillId: r.skillId, reason: r.rejectReason, l2Summary: r.layer2?.summary }));
  fs.writeFileSync(
    path.join(outputDir, "review-skills.json"),
    JSON.stringify(reviewList, null, 2),
    "utf-8",
  );

  // 4. Markdown 汇总报告
  const md = generateMarkdownSummary(stats, results, dateStr);
  fs.writeFileSync(
    path.join(outputDir, `wash-summary-${dateStr}.md`),
    md,
    "utf-8",
  );

  // 5. 精选技能索引 (skills-index.json)
  const index = generateSkillsIndex(results);
  fs.writeFileSync(
    path.join(path.resolve(OUTPUT_DIR), "skills-index.json"),
    JSON.stringify(index, null, 2),
    "utf-8",
  );

  console.log(`  📊 wash-report-${dateStr}.json`);
  console.log(`  📊 wash-summary-${dateStr}.md`);
  console.log(`  📊 rejected-skills.json (${rejectedList.length} 条)`);
  console.log(`  📊 review-skills.json (${reviewList.length} 条)`);
  console.log(`  📊 skills-index.json (${results.filter(r => r.finalDecision === "accepted").length} 条)`);
}

// ============================================================================
// Markdown 汇总报告
// ============================================================================

function generateMarkdownSummary(stats: BatchStats, results: PipelineResult[], dateStr: string): string {
  const accepted = results.filter(r => r.finalDecision === "accepted");
  const minutes = Math.round(stats.totalProcessingMs / 60_000);

  let md = `# Skills 清洗报告 — ${dateStr}\n\n`;
  md += `> Pipeline v${REPORT_CONFIG.pipelineVersion} | 生成时间: ${new Date().toISOString()}\n\n`;

  // 执行摘要
  md += `## 执行摘要\n\n`;
  md += `| 指标 | 数量 |\n|------|------|\n`;
  md += `| 扫描技能总数 | ${stats.totalScanned} |\n`;
  md += `| Layer 1 淘汰 | ${stats.layer1Rejected} |\n`;
  md += `| Layer 2 淘汰 | ${stats.layer2Rejected} |\n`;
  md += `| Layer 2 人工复审 | ${stats.layer2Review} |\n`;
  md += `| Layer 3 质量不达标 | ${stats.layer3Excluded} |\n`;
  md += `| **最终收录** | **${stats.finalAccepted}** |\n\n`;

  // 评级分布
  md += `## 评级分布\n\n`;
  md += `| 评级 | 数量 |\n|------|------|\n`;
  md += `| S (精选推荐) | ${stats.tierDistribution.S} |\n`;
  md += `| A (推荐) | ${stats.tierDistribution.A} |\n`;
  md += `| B (可选) | ${stats.tierDistribution.B} |\n\n`;

  // 分类分布
  if (Object.keys(stats.categoryDistribution).length > 0) {
    md += `## 分类分布\n\n`;
    md += `| 分类 | 数量 |\n|------|------|\n`;
    for (const [cat, count] of Object.entries(stats.categoryDistribution).sort((a, b) => b[1] - a[1])) {
      md += `| ${cat} | ${count} |\n`;
    }
    md += `\n`;
  }

  // 安全发现
  md += `## 安全发现\n\n`;
  md += `| 类型 | 命中次数 |\n|------|----------|\n`;
  md += `| 提示词注入 | ${stats.securityFindings.promptInjection} |\n`;
  md += `| 数据窃取 | ${stats.securityFindings.dataExfil} |\n`;
  md += `| 命令注入 | ${stats.securityFindings.commandInjection} |\n`;
  md += `| 混淆 | ${stats.securityFindings.obfuscation} |\n`;
  md += `| 加密挖矿 | ${stats.securityFindings.cryptoMining} |\n`;
  md += `| 权限提升 | ${stats.securityFindings.privilegeEscalation} |\n\n`;

  // Token 消耗
  md += `## Token 消耗\n\n`;
  md += `- 输入 tokens: ${stats.totalInputTokens.toLocaleString()}\n`;
  md += `- 输出 tokens: ${stats.totalOutputTokens.toLocaleString()}\n`;
  md += `- 预估费用: ¥${stats.estimatedCostCNY}\n`;
  md += `- 处理时间: ~${minutes} 分钟\n\n`;

  // 收录清单
  if (accepted.length > 0) {
    md += `## 收录清单\n\n`;
    md += `| 技能 | 评级 | 得分 | 分类 | CN可用 |\n|------|------|------|------|--------|\n`;
    for (const r of accepted.sort((a, b) => (b.layer3?.quality.overallScore ?? 0) - (a.layer3?.quality.overallScore ?? 0))) {
      const cnOk = r.layer3?.quality.cnBlocked ? "❌" : "✅";
      md += `| ${r.skillId} | ${r.finalTier} | ${r.layer3?.quality.overallScore.toFixed(1)} | ${r.layer3?.quality.category ?? "-"} | ${cnOk} |\n`;
    }
  }

  return md;
}

// ============================================================================
// 精选技能索引
// ============================================================================

function generateSkillsIndex(results: PipelineResult[]): object {
  const accepted = results.filter(r => r.finalDecision === "accepted");

  const skills = accepted.map(r => ({
    name: r.skillId,
    description: r.layer3?.quality.highlights ?? "",
    descriptionZh: r.layer3?.quality.summary ?? "",
    path: r.skillId,
    tier: r.finalTier,
    overallScore: r.layer3?.quality.overallScore,
    category: r.layer3?.quality.category ?? "",
    tags: r.layer3?.quality.tags ?? [],
    cnBlocked: r.layer3?.quality.cnBlocked ?? false,
    cnAlternative: r.layer3?.quality.cnAlternative ?? "",
    hasTranslation: r.layer3?.translation?.validationPassed ?? false,
  }));

  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    pipelineVersion: REPORT_CONFIG.pipelineVersion,
    stats: {
      totalScanned: results.length,
      finalAccepted: accepted.length,
      tierDistribution: {
        S: accepted.filter(r => r.finalTier === "S").length,
        A: accepted.filter(r => r.finalTier === "A").length,
        B: accepted.filter(r => r.finalTier === "B").length,
      },
    },
    skills,
  };
}
