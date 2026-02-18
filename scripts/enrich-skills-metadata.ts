#!/usr/bin/env node
/**
 * Skills Metadata Enrichment Script
 *
 * 为 Skills 补充中文翻译、标签和搜索关键词
 * 使用阿里云通义千问 API 进行智能翻译和关键词提取
 *
 * Usage:
 *   pnpm tsx scripts/enrich-skills-metadata.ts
 *   pnpm tsx scripts/enrich-skills-metadata.ts --limit 10  # 测试模式
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

// ============================================================================
// Configuration
// ============================================================================

// 使用智谱AI GLM API（OpenAI 兼容格式）
const API_KEY = process.env.GLM_API_KEY || "4ddd4ab6a37d41e0ac445e8a3646db0a.Hg5KLqcnOT8EVKSq";
const BASE_URL = "https://open.bigmodel.cn/api/paas/v4"; // 智谱AI endpoint
const MODEL = "glm-4-flash"; // GLM-4 Flash 模型（速度快）

// 检查 API Key
if (!API_KEY) {
  console.error("\n❌ Error: GLM_API_KEY is required!");
  process.exit(1);
}

console.log(`🔑 Using GLM API: ${BASE_URL}`);
console.log(`🤖 Model: ${MODEL}`);

const CACHE_FILE = path.join(ROOT_DIR, "data", ".skills-enrichment-cache.json");
const INPUT_FILE = path.join(ROOT_DIR, "data", "skills-availability-dictionary.json");
const OUTPUT_FILE = path.join(ROOT_DIR, "data", "skills-availability-dictionary-enriched.json");

const CONCURRENCY = 20; // 并发数（GLM速率限制更宽松）
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // ms（重试延迟）

// ============================================================================
// Types
// ============================================================================

interface EnrichedSkill {
  id: string;
  type: "skill";
  name: string;
  nameZh: string;
  nameEn: string;
  description: string;
  descriptionZh: string;
  descriptionEn: string;
  tags: string[];
  keywords: string[];
  useCases: string[];
  category: string;
  availability: any;
  metadata: {
    source: string;
    homepage?: string;
    emoji?: string;
    version?: string;
    lastUpdated: string;
  };
  classification: {
    autoDetected: boolean;
    manualVerified: boolean;
    detectionMethod: string;
    enrichedAt: string;
  };
}

interface TranslationResponse {
  nameZh: string;
  descriptionZh: string;
  tags: string[];
  keywords: string[];
  useCases: string[];
}

// ============================================================================
// Cache Management
// ============================================================================

let cache: Record<string, TranslationResponse> = {};

async function loadCache(): Promise<void> {
  try {
    const content = await fs.readFile(CACHE_FILE, "utf-8");
    cache = JSON.parse(content);
    console.log(`✅ Loaded ${Object.keys(cache).length} cached translations`);
  } catch {
    cache = {};
  }
}

async function saveCache(): Promise<void> {
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
}

// ============================================================================
// LLM Translation
// ============================================================================

async function translateSkill(
  name: string,
  description: string,
  category: string,
  emoji?: string
): Promise<TranslationResponse> {
  const cacheKey = `${name}|||${description}`;

  // 检查缓存
  if (cache[cacheKey]) {
    return cache[cacheKey];
  }

  const prompt = `你是一个专业的技术翻译和关键词提取专家。分析以下 Skill 的关键信息（注意：只翻译元数据，不翻译内部文档）。

**Skill 信息：**
- 英文名: ${name}
- 英文描述: ${description}
- 分类: ${category}

**任务：提供以下关键信息（只返回 JSON）：**

1. **nameZh**: 中文名称（2-6字，简洁专业）
2. **descriptionZh**: 中文描述（30-60字，说明核心功能）
3. **tags**: 3-5个中文标签（如 ["开发工具", "GitHub", "版本控制"]）
4. **keywords**: 6-10个关键词（中英混合，用于向量搜索，如 ["GitHub", "代码托管", "git", "PR审查", "Issue管理"]）
5. **useCases**: 3-5个使用场景（每个10-15字，如 "管理GitHub仓库的Issue和PR"）

**返回纯 JSON（不要markdown包裹）：**
{
  "nameZh": "中文名称",
  "descriptionZh": "中文描述",
  "tags": ["标签1", "标签2", "标签3"],
  "keywords": ["关键词1", "关键词2", "关键词3", "关键词4", "关键词5", "关键词6"],
  "useCases": ["场景1", "场景2", "场景3"]
}

要求：
- 翻译准确专业，符合技术领域习惯
- keywords 要全面：产品名、技术栈、功能、场景
- tags 精炼分类，useCases 实用具体
- 只返回JSON，不要解释文字`;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "user", content: prompt }
          ],
          temperature: 0.3, // 低温度确保稳定输出
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || "";

      // 提取 JSON（支持 ```json 包裹或纯 JSON）
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
                       content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const result: TranslationResponse = JSON.parse(jsonMatch[jsonMatch.length - 1]);

      // 验证必需字段
      if (!result.nameZh || !result.descriptionZh || !result.tags || !result.keywords) {
        throw new Error("Missing required fields in response");
      }

      // 缓存结果
      cache[cacheKey] = result;
      return result;

    } catch (error) {
      console.warn(`   ⚠️  Attempt ${attempt}/${RETRY_ATTEMPTS} failed for ${name}: ${error}`);
      if (attempt < RETRY_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      } else {
        // 失败后返回默认值
        return {
          nameZh: name,
          descriptionZh: description,
          tags: [category],
          keywords: [name, category],
          useCases: ["待补充"],
        };
      }
    }
  }

  // 不应该到达这里
  throw new Error("Translation failed after all retries");
}

// ============================================================================
// Main Processing
// ============================================================================

async function enrichSkills(limit?: number): Promise<void> {
  console.log(`\n🚀 Starting Skills metadata enrichment...\n`);

  // 加载缓存
  await loadCache();

  // 读取原始数据
  const inputData = JSON.parse(await fs.readFile(INPUT_FILE, "utf-8"));
  const skills = limit ? inputData.skills.slice(0, limit) : inputData.skills;

  console.log(`📊 Total skills to enrich: ${skills.length}`);
  console.log(`🔄 Concurrency: ${CONCURRENCY}`);
  console.log(`💾 Cached: ${Object.keys(cache).length}\n`);

  const enrichedSkills: EnrichedSkill[] = [];
  let processed = 0;
  let cached = 0;
  let translated = 0;

  // 分批处理
  for (let i = 0; i < skills.length; i += CONCURRENCY) {
    const batch = skills.slice(i, i + CONCURRENCY);

    const results = await Promise.all(
      batch.map(async (skill: any) => {
        const cacheKey = `${skill.name}|||${skill.description}`;
        const isCached = !!cache[cacheKey];

        if (isCached) cached++;
        else translated++;

        const translation = await translateSkill(
          skill.name,
          skill.description,
          skill.category,
          skill.metadata?.emoji
        );

        processed++;
        if (processed % 10 === 0) {
          console.log(`   Processed ${processed}/${skills.length} (${cached} cached, ${translated} translated)`);
        }

        return {
          ...skill,
          type: "skill",
          nameZh: translation.nameZh,
          nameEn: skill.name,
          descriptionZh: translation.descriptionZh,
          descriptionEn: skill.description,
          tags: translation.tags,
          keywords: translation.keywords,
          useCases: translation.useCases,
          metadata: {
            ...skill.metadata,
            version: "1.0.0",
            lastUpdated: new Date().toISOString(),
          },
          classification: {
            autoDetected: true,
            manualVerified: false,
            detectionMethod: "llm-enrichment",
            enrichedAt: new Date().toISOString(),
          },
        };
      })
    );

    enrichedSkills.push(...results);

    // 每批次后保存缓存
    await saveCache();
  }

  console.log(`\n✅ Enrichment complete!`);
  console.log(`   Total: ${enrichedSkills.length}`);
  console.log(`   Cached: ${cached}`);
  console.log(`   Translated: ${translated}\n`);

  // 生成输出
  const output = {
    version: "2.0.0",
    generatedAt: new Date().toISOString(),
    summary: {
      ...inputData.summary,
      enriched: true,
      translationProvider: "moonshot-v1-8k (Kimi)",
    },
    skills: enrichedSkills,
  };

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf-8");
  console.log(`💾 Saved to: ${OUTPUT_FILE}`);
  console.log(`   File size: ${(JSON.stringify(output).length / 1024 / 1024).toFixed(2)} MB\n`);

  // 打印示例
  console.log(`📝 Sample enriched skill:\n`);
  const sample = enrichedSkills[0];
  console.log(`   ID: ${sample.id}`);
  console.log(`   名称: ${sample.nameZh} (${sample.nameEn})`);
  console.log(`   描述: ${sample.descriptionZh}`);
  console.log(`   标签: ${sample.tags.join(", ")}`);
  console.log(`   关键词: ${sample.keywords.join(", ")}`);
  console.log(`   使用场景: ${sample.useCases.join("; ")}`);
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const limitIndex = args.indexOf("--limit");
  const limit = limitIndex >= 0 && args[limitIndex + 1]
    ? parseInt(args[limitIndex + 1], 10)
    : undefined;

  if (limit) {
    console.log(`\n⚠️  Test mode: Processing first ${limit} skills\n`);
  }

  try {
    await enrichSkills(limit);
    console.log(`🎉 All done!\n`);
  } catch (error) {
    console.error(`\n❌ Error:`, error);
    process.exit(1);
  }
}

main();
