/**
 * Layer 3a: 质量评估 + Layer 3b: 汉化翻译
 */

import { LAYER3_THRESHOLDS } from "./config.js";
import { callQwen, callQwenJson } from "./qwen-client.js";
import type { SkillInput, Layer3Result, QualityScores } from "./types.js";

// ============================================================================
// Layer 3a: 质量评估提示词
// ============================================================================

const QUALITY_SYSTEM_PROMPT = `# 角色：AI Agent Skill 质量评估专家

评估技能的实用价值和技术质量。评估结果决定是否收录到精选技能库。

## 评估维度（每项 1-10 分）

### 1. utility（功能实用性）
- 10: 高频刚需，无替代方案
- 7-9: 实用且面向广泛用户
- 4-6: 特定场景有用
- 1-3: 几乎无实际用途

### 2. completeness（描述完整度）
- description 是否清晰
- 是否有使用示例
- 依赖是否声明完整

### 3. technical_quality（技术质量）
- 指令是否清晰无歧义
- 代码示例是否正确
- 是否遵循最佳实践

### 4. maintenance（维护状态）
- 是否有 homepage
- 外部服务是否仍可用

### 5. cn_compatibility（CN 适配度）
- 10: 中国大陆完全可用
- 7-9: 主要功能可用
- 4-6: 需配置镜像
- 1-3: 核心功能被墙

## 输出格式（严格 JSON）
{
  "scores": {
    "utility": 8,
    "completeness": 7,
    "technical_quality": 9,
    "maintenance": 6,
    "cn_compatibility": 8
  },
  "overall_score": 7.6,
  "tier": "S|A|B|C|D",
  "category": "主分类",
  "tags": ["tag1", "tag2"],
  "cn_blocked": false,
  "cn_alternative": "",
  "highlights": "亮点(中文)",
  "weaknesses": "不足(中文)",
  "summary": "一句话总评(中文)",
  "recommendation": "收录|观望|不收录"
}

## 评级: S(9+) A(7-8.9) B(5-6.9) C(3-4.9) D(0-2.9)`;

// ============================================================================
// Layer 3b: 汉化翻译提示词
// ============================================================================

const TRANSLATE_SYSTEM_PROMPT = `# 角色：AI 技术文档翻译专家

将英文 SKILL.md 翻译为高质量中文版本。

## 规则
1. frontmatter.name 保持英文不变
2. frontmatter.description 翻译为中文
3. body 全部翻译为中文
4. 代码块、命令、URL、变量名保持英文
5. 技术术语无通用译法时保留英文 (API, OAuth, webhook 等)
6. 使用简洁准确的技术文档风格

## 常见术语
- skill → 技能, agent → 智能体, prompt → 提示词
- workspace → 工作区, credentials → 凭据
- webhook/API Key/Token → 不译

直接输出翻译后的完整 SKILL.md 内容（含 frontmatter），不要加额外说明。`;

// ============================================================================
// 质量评估结果类型
// ============================================================================

interface QualityResponse {
  scores: {
    utility: number;
    completeness: number;
    technical_quality: number;
    maintenance: number;
    cn_compatibility: number;
  };
  overall_score: number;
  tier: string;
  category: string;
  tags: string[];
  cn_blocked: boolean;
  cn_alternative: string;
  highlights: string;
  weaknesses: string;
  summary: string;
  recommendation: string;
}

// ============================================================================
// 翻译验证
// ============================================================================

function validateTranslation(original: string, translated: string): boolean {
  // 检查 frontmatter 是否保留
  if (!translated.startsWith("---")) return false;

  // 检查代码块数量是否一致（允许 ±1 误差）
  const origBlocks = (original.match(/```/g) || []).length;
  const transBlocks = (translated.match(/```/g) || []).length;
  if (Math.abs(origBlocks - transBlocks) > 2) return false;

  // 检查长度比（中文通常比英文短，但不应差太多）
  const ratio = translated.length / original.length;
  if (ratio < 0.3 || ratio > 2.0) return false;

  // 检查是否有足够的中文字符
  const chineseChars = (translated.match(/[\u4e00-\u9fff]/g) || []).length;
  if (chineseChars < 10) return false;

  return true;
}

// ============================================================================
// 主函数
// ============================================================================

export async function runLayer3(input: SkillInput): Promise<Layer3Result> {
  const startTime = Date.now();
  let totalTokens = 0;

  // ===== Layer 3a: 质量评估 =====
  console.log(`  📊 质量评估中...`);

  const { parsed: qualityResult, raw: qualityRaw } = await callQwenJson<QualityResponse>(
    QUALITY_SYSTEM_PROMPT,
    `请评估以下 SKILL.md：\n\n<skill_content>\n${input.rawContent}\n</skill_content>\n\n请以 JSON 输出。`,
  );
  totalTokens += qualityRaw.inputTokens + qualityRaw.outputTokens;

  const scores: QualityScores = {
    utility: qualityResult.scores?.utility ?? 5,
    completeness: qualityResult.scores?.completeness ?? 5,
    technicalQuality: qualityResult.scores?.technical_quality ?? 5,
    maintenance: qualityResult.scores?.maintenance ?? 5,
    cnCompatibility: qualityResult.scores?.cn_compatibility ?? 5,
  };

  const overallScore = qualityResult.overall_score ?? (
    (scores.utility + scores.completeness + scores.technicalQuality + scores.maintenance + scores.cnCompatibility) / 5
  );

  let tier: "S" | "A" | "B" | "C" | "D";
  if (overallScore >= LAYER3_THRESHOLDS.sTierThreshold) tier = "S";
  else if (overallScore >= LAYER3_THRESHOLDS.aTierThreshold) tier = "A";
  else if (overallScore >= LAYER3_THRESHOLDS.minOverallScore) tier = "B";
  else if (overallScore >= 3.0) tier = "C";
  else tier = "D";

  // ===== Layer 3b: 汉化翻译（仅 B 级以上） =====
  let translation: Layer3Result["translation"] | undefined;

  if (overallScore >= LAYER3_THRESHOLDS.minOverallScore && !qualityResult.cn_blocked) {
    console.log(`  🌐 汉化翻译中...`);

    const transRaw = await callQwen(
      TRANSLATE_SYSTEM_PROMPT,
      `请将以下 SKILL.md 翻译为中文版本：\n\n<skill_content>\n${input.rawContent}\n</skill_content>`,
      { maxTokens: 8192 },
    );
    totalTokens += transRaw.inputTokens + transRaw.outputTokens;

    const valid = validateTranslation(input.rawContent, transRaw.content);
    translation = {
      translatedContent: transRaw.content,
      validationPassed: valid,
    };

    if (!valid) {
      console.log(`  ⚠ 翻译验证未通过，将使用英文原版`);
    }
  } else if (qualityResult.cn_blocked) {
    console.log(`  🚫 技能依赖被墙服务，跳过翻译`);
  } else {
    console.log(`  ⏭ 评分 ${overallScore.toFixed(1)} 未达 B 级(5.0)，跳过翻译`);
  }

  return {
    skillId: input.skillId,
    quality: {
      scores,
      overallScore,
      tier,
      category: qualityResult.category ?? "未分类",
      tags: qualityResult.tags ?? [],
      cnBlocked: qualityResult.cn_blocked ?? false,
      cnAlternative: qualityResult.cn_alternative ?? "",
      highlights: qualityResult.highlights ?? "",
      weaknesses: qualityResult.weaknesses ?? "",
      summary: qualityResult.summary ?? "",
      recommendation: qualityResult.recommendation ?? "观望",
    },
    translation,
    modelUsed: qualityRaw.model,
    totalTokens,
    processingTimeMs: Date.now() - startTime,
  };
}
