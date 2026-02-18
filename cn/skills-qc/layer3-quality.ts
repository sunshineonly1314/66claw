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
- 7-9: 实用且面向广泛用户群
- 4-6: 特定场景有用
- 1-3: 几乎无实际用途

### 2. completeness（描述完整度）
- description 是否清晰
- 是否有使用示例或操作步骤
- 依赖是否声明完整
- 错误处理/故障排除是否有说明

### 3. technical_quality（技术质量）
- 指令是否清晰无歧义
- 代码示例是否正确
- 是否遵循最佳实践
- 参数和返回值是否有说明

### 4. maintenance（维护状态）
- 是否有 homepage 或外部参考链接
- 外部服务是否仍可用
- 技能内容是否过时

### 5. cn_compatibility（CN 适配度）
- 10: 中国大陆完全可用（纯本地或国内服务）
- 8-9: 核心功能可用，个别特性受限
- 5-7: 需配置镜像/代理后可用
- 3-4: 核心依赖被墙，功能严重受限
- 1-2: 完全不可用（依赖 Google/OpenAI/被墙 API 且无替代）

**cn_blocked 判断标准**：
- true: 核心功能依赖被墙的外部服务（如 Google API、OpenAI API、Slack API 等），在中国大陆无法正常使用
- false: 可在中国大陆正常使用，或仅依赖国内可达的服务

## 分类规范（必须从以下列表中选择一个）

| 分类 | 适用场景 |
|------|----------|
| 开发工具 | 编程辅助、代码审查、IDE 集成、CI/CD、包管理、构建打包 |
| 生产力工具 | 笔记、待办、日历、邮件、文件管理、办公自动化 |
| 多媒体 | 图像/音频/视频处理、播放控制、格式转换、屏幕截图 |
| 通信协作 | 即时通讯、团队协作、邮件客户端、会议、通知推送 |
| AI 工具 | AI 模型调用、图像生成、语音合成/识别、翻译 |
| 智能家居 | 家居设备控制、IoT 集成、自动化场景 |
| 安全工具 | 密钥管理、密码管理、安全审计、加密解密 |
| 数据工具 | 数据查询、API 集成、天气/财经/地理等信息服务 |
| 内容管理 | 博客、文档生成、CMS、内容监控、RSS |
| 系统工具 | 系统配置、运维、部署、打包分发 |

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
  "category": "从上表选择一个分类",
  "tags": ["中文标签1", "中文标签2", "中文标签3"],
  "cn_blocked": false,
  "cn_alternative": "如 cn_blocked 为 true，给出国内替代方案建议；否则留空",
  "highlights": "核心亮点(中文，1-2句)",
  "weaknesses": "主要不足(中文，1-2句)",
  "summary": "一句话总评(中文)",
  "recommendation": "收录|观望|不收录"
}

## 评分和评级
- overall_score = 5 个维度分数的算术平均值，保留 1 位小数
- S 级: 9.0+（精选推荐）
- A 级: 7.0-8.9（推荐）
- B 级: 5.0-6.9（可选）
- C 级: 3.0-4.9（不收录）
- D 级: 0-2.9（不收录）

## 标签规范（tags）
- **必须全部使用中文**，3-5 个标签
- 标签描述该技能的**使用场景和功能特征**，方便用户按场景搜索
- 好的标签示例：笔记、天气、日历、邮件、密码管理、语音识别、智能家居、代码审查、任务管理、预算理财、音乐播放、图像生成、PDF处理、浏览器、RSS阅读
- 禁止使用：英文标签、技能名称本身、过于宽泛的标签（如"工具"、"AI"）`;

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
