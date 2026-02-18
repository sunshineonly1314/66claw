/**
 * 核心丰富逻辑
 *
 * 读取 SkillWash v2 输出 → 丰富为 v3 EnrichedSkillMeta → 输出 SkillsIndexV3
 */

import fs from "node:fs";
import path from "node:path";
import { SKILLSUPDATE_CONFIG } from "./config.js";
import { CATEGORY_DEFS, normalizeCategoryZh, getCategoryZh, computeCnStatus } from "./categories.js";
import type {
  WashIndexV2,
  WashSkillEntry,
  SkillReport,
  SkillMetadata,
  EnrichedSkillMeta,
  SkillsIndexV3,
  CategoryId,
  CnStatus,
} from "./types.js";

// ============================================================================
// 数据加载
// ============================================================================

/** 读取 SkillWash v2 索引 */
export function loadWashIndex(): WashIndexV2 {
  const filePath = path.resolve(SKILLSUPDATE_CONFIG.washIndexFile);
  if (!fs.existsSync(filePath)) {
    throw new Error(`SkillWash 索引不存在: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as WashIndexV2;
}

/** 读取单技能审计报告（获取详细评分，尤其是 cnCompatibility） */
export function loadSkillReport(skillId: string): SkillReport | null {
  const filePath = path.resolve(SKILLSUPDATE_CONFIG.washReportDir, `${skillId}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as SkillReport;
  } catch {
    return null;
  }
}

/**
 * 从 SKILL.md frontmatter 提取 clawdbot metadata
 *
 * 复用 cn/skills-qc/pipeline.ts 的 parseSkillMd 逻辑，
 * 但只提取 metadata JSON 部分。
 */
export function extractMetadata(skillId: string): SkillMetadata | null {
  const filePath = path.resolve(SKILLSUPDATE_CONFIG.skillsDir, skillId, "SKILL.md");
  if (!fs.existsSync(filePath)) return null;

  try {
    const content = fs.readFileSync(filePath, "utf-8");

    // 解析 frontmatter
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (!fmMatch) return null;

    const fmRaw = fmMatch[1];

    // 提取 metadata JSON
    // 方式 1: 单行 metadata: {...}
    const metaLine = fmRaw.split("\n").find((l) => l.startsWith("metadata:"));
    if (!metaLine) return null;

    const jsonStr = metaLine.substring("metadata:".length).trim();
    const parsed = JSON.parse(jsonStr);
    return (parsed?.clawdbot ?? null) as SkillMetadata | null;
  } catch {
    return null;
  }
}

// ============================================================================
// 丰富单技能
// ============================================================================

export function enrichSkill(
  entry: WashSkillEntry,
  report: SkillReport | null,
  metadata: SkillMetadata | null,
): EnrichedSkillMeta {
  // 1. 分类映射
  const category = normalizeCategoryZh(entry.category);
  const categoryZh = getCategoryZh(category);

  // 2. CN 状态计算
  const cnCompatibility = report?.layer3?.quality.scores.cnCompatibility ?? 5;
  const cnStatus = computeCnStatus(entry.cnBlocked, cnCompatibility);

  // 3. 平台提取
  const platforms = extractPlatforms(metadata);

  // 4. 依赖提取
  const requiresBins = extractRequiresBins(metadata);

  // 5. 安装方式提取
  const installMethods = extractInstallMethods(metadata);

  // 6. 详细信息
  const highlights = report?.layer3?.quality.highlights ?? entry.description;
  const weaknesses = report?.layer3?.quality.weaknesses ?? "";

  return {
    name: entry.name,
    description: entry.description,
    descriptionZh: entry.descriptionZh,
    emoji: metadata?.emoji,
    path: entry.path,
    // v3 新增
    category,
    categoryZh,
    tags: entry.tags,
    cnStatus,
    cnBlocked: entry.cnBlocked,
    cnAlternative: entry.cnAlternative,
    tier: entry.tier,
    overallScore: entry.overallScore,
    platforms,
    requiresBins,
    installMethods,
    hasTranslation: entry.hasTranslation,
    highlights,
    weaknesses,
  };
}

// ============================================================================
// metadata 提取辅助
// ============================================================================

function extractPlatforms(metadata: SkillMetadata | null): string[] {
  if (!metadata?.os) return [];
  return metadata.os;
}

function extractRequiresBins(metadata: SkillMetadata | null): string[] {
  if (!metadata?.requires) return [];
  const bins = new Set<string>();
  for (const b of metadata.requires.bins ?? []) bins.add(b);
  for (const b of metadata.requires.anyBins ?? []) bins.add(b);
  return [...bins];
}

function extractInstallMethods(metadata: SkillMetadata | null): string[] {
  if (!metadata?.install) return [];
  const methods = new Set<string>();
  for (const inst of metadata.install) {
    methods.add(inst.kind);
  }
  return [...methods];
}

// ============================================================================
// 批量丰富
// ============================================================================

export function enrichAll(): SkillsIndexV3 {
  const washIndex = loadWashIndex();

  console.log(`📥 读取 SkillWash v2 索引: ${washIndex.skills.length} 个 skills`);

  const enrichedSkills: EnrichedSkillMeta[] = [];
  const categoryDist: Partial<Record<CategoryId, number>> = {};
  const cnStatusDist: Record<CnStatus, number> = {
    "cn-native": 0,
    "cn-proxy": 0,
    "cn-blocked": 0,
  };

  for (const entry of washIndex.skills) {
    const report = loadSkillReport(entry.name);
    const metadata = extractMetadata(entry.name);
    const enriched = enrichSkill(entry, report, metadata);

    enrichedSkills.push(enriched);

    // 统计
    categoryDist[enriched.category] = (categoryDist[enriched.category] ?? 0) + 1;
    cnStatusDist[enriched.cnStatus]++;

    const metaInfo = metadata
      ? `[${enriched.platforms.join(",") || "all"}] bins:${enriched.requiresBins.join(",") || "none"} install:${enriched.installMethods.join(",") || "none"}`
      : "no-metadata";

    console.log(
      `  ${enriched.cnStatus === "cn-native" ? "🟢" : enriched.cnStatus === "cn-proxy" ? "🟡" : "🔴"} ` +
      `${enriched.name.padEnd(25)} ${enriched.tier} ${enriched.overallScore.toFixed(1)} ` +
      `[${enriched.categoryZh}] ${metaInfo}`,
    );
  }

  // 构建 v3 索引
  const tierDist = { S: 0, A: 0, B: 0 };
  for (const s of enrichedSkills) {
    tierDist[s.tier]++;
  }

  const index: SkillsIndexV3 = {
    schemaVersion: 3,
    generatedAt: new Date().toISOString(),
    pipelineVersion: SKILLSUPDATE_CONFIG.pipelineVersion,
    stats: {
      totalScanned: washIndex.stats.totalScanned,
      finalAccepted: enrichedSkills.length,
      tierDistribution: tierDist,
      categoryDistribution: categoryDist,
      cnStatusDistribution: cnStatusDist,
    },
    categories: CATEGORY_DEFS,
    skills: enrichedSkills,
  };

  return index;
}

// ============================================================================
// 输出
// ============================================================================

export function saveIndexV3(index: SkillsIndexV3): string {
  const outputDir = path.resolve(SKILLSUPDATE_CONFIG.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, "skills-index-v3.json");
  const tmpPath = outputPath + ".tmp";

  fs.writeFileSync(tmpPath, JSON.stringify(index, null, 2), "utf-8");
  fs.renameSync(tmpPath, outputPath);

  return outputPath;
}
