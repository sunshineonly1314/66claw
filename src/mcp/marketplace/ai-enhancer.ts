/**
 * AI-powered MCP marketplace data enhancement.
 *
 * Uses Kimi Code API to batch-translate and intelligently tag MCP servers.
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { McpMarketplaceItem } from "./types.js";

const logger = createSubsystemLogger("ai-enhancer");

// ============================================================================
// Config
// ============================================================================

export interface KimiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  batchSize: number;
  concurrency: number;
  retries: number;
  delayMs: number;
  maxTokens: number;
  temperature: number;
}

const DEFAULT_KIMI_CONFIG: Omit<KimiConfig, "apiKey"> = {
  // Use Doubao (ByteDance Volcano Engine)
  baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
  model: "doubao-pro-128k", // Doubao 1.8 Pro
  batchSize: 25,
  concurrency: 3,
  retries: 3,
  delayMs: 1000,
  maxTokens: 8192,
  temperature: 0.3,
};

/** Enhancement version - increment when changing prompt/logic */
const ENHANCEMENT_VERSION = 1;

// ============================================================================
// System Prompt
// ============================================================================

const ENHANCEMENT_SYSTEM_PROMPT = `你是 MCP 服务智能分析专家。任务：分析 MCP 服务器元数据并增强。

输入：JSON 数组，每个对象包含 serverId、friendlyName、description、category 等字段
输出：增强后的 JSON 数组，每个对象增加以下字段：

1. friendlyNameCn: 中文名称（2-8 汉字，简洁专业）
2. descriptionCn: 中文描述（20-50 字，突出核心功能）
3. tagsCn: 5-8 个中文标签，覆盖功能、场景、技术栈
4. availability: {
     requiresVPN: boolean,           // 服务依赖被墙的 API（OpenAI/GitHub等）
     chinaFriendlyScore: 0-100,      // 国内可用度评分
     chinaBlockReasons: string[]     // 如果 <50 分，说明原因
   }
5. requirements: {
     runtimeDeps: string[],          // 如 ["Node.js >=18"]
     platformNotes: string,          // 平台限制说明
     systemDeps: string[]            // 如 ["Docker", "PostgreSQL"]
   }
6. categoryEnhanced: [              // 多标签分类（最多 3 个）
     { category: "filesystem", confidence: 95 },
     { category: "network", confidence: 60 }
   ]
7. recommendationScore: {           // 智能推荐评分
     beginnerFriendly: 0-100,       // 新手友好度
     enterpriseReady: 0-100,        // 企业级成熟度
     communityActivity: 0-100       // 社区活跃度
   }
8. useCaseKeywords: string[]       // 使用场景关键词，如 ["文档管理", "团队协作"]

规则：
- requiresVPN=true：依赖 OpenAI/Anthropic/Google/GitHub/Tavily/Perplexity 等被墙服务
- chinaFriendlyScore 评分标准：
  * 90-100: 纯本地运行或依赖国产 API（Qwen/DeepSeek/Kimi/Doubao）
  * 60-89: 可选配置国产替代，或有国内镜像
  * 30-59: 依赖国外 API 但有替代方案
  * 0-29: 强依赖被墙服务且无替代
- 标签优先级：功能 > 场景 > 技术栈 > 行业
- 描述避免重复 friendlyName，突出差异化价值
- beginnerFriendly 评分：开箱即用(90-100)、需配置(60-89)、需编程(30-59)、高级复杂(0-29)
- enterpriseReady 评分：考虑安全性、稳定性、文档完善度
- communityActivity 评分：根据 serverId 知名度、维护状态推测（如果是官方/知名项目分数高）

可用的 category 值：filesystem, database, search, productivity, development, network, smarthome, ai, social, other

返回格式：纯 JSON 数组，不要 markdown 代码块。每个对象保留原始 serverId，并添加上述增强字段。`;

// ============================================================================
// Core Enhancement Function
// ============================================================================

export interface EnhancementResult {
  enhanced: McpMarketplaceItem[];
  errors: Array<{ serverId: string; error: string }>;
}

/**
 * Enhance MCP marketplace items with Kimi Code API (with concurrency).
 */
export async function enhanceWithKimiCode(
  items: McpMarketplaceItem[],
  config: KimiConfig,
): Promise<EnhancementResult> {
  const batches = chunk(items, config.batchSize);
  const enhanced: McpMarketplaceItem[] = [];
  const errors: Array<{ serverId: string; error: string }> = [];

  logger.info(
    `Enhancing ${items.length} items in ${batches.length} batches (concurrency: ${config.concurrency})...`,
  );

  // Process batches with controlled concurrency
  for (let i = 0; i < batches.length; i += config.concurrency) {
    const concurrentBatches = batches.slice(i, i + config.concurrency);
    const batchPromises = concurrentBatches.map(async (batch, localIndex) => {
      const globalIndex = i + localIndex;
      logger.info(
        `Processing batch ${globalIndex + 1}/${batches.length} (${batch.length} items)...`,
      );

      try {
        const result = await callKimiWithRetry({
          systemPrompt: ENHANCEMENT_SYSTEM_PROMPT,
          userPrompt: JSON.stringify(batch.map(simplifyForAI)),
          config,
        });

        const enhancedBatch = mergeEnhancedData(batch, result);
        logger.info(`Batch ${globalIndex + 1} completed: ${enhancedBatch.length} items enhanced`);
        return { enhancedBatch, batchErrors: [] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`Batch ${globalIndex + 1} failed: ${msg}`);
        const batchErrors = batch.map((item) => ({ serverId: item.serverId, error: msg }));
        return { enhancedBatch: batch, batchErrors }; // Return original items on failure
      }
    });

    const results = await Promise.all(batchPromises);

    for (const { enhancedBatch, batchErrors } of results) {
      enhanced.push(...enhancedBatch);
      errors.push(...batchErrors);
    }

    // Rate limiting delay between concurrency groups
    if (i + config.concurrency < batches.length) {
      await sleep(config.delayMs);
    }
  }

  logger.info(`Enhancement complete: ${enhanced.length} items, ${errors.length} errors`);
  return { enhanced, errors };
}

// ============================================================================
// Kimi API Call with Retry
// ============================================================================

interface KimiCallParams {
  systemPrompt: string;
  userPrompt: string;
  config: KimiConfig;
}

async function callKimiWithRetry(params: KimiCallParams): Promise<string> {
  const { systemPrompt, userPrompt, config } = params;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.retries; attempt++) {
    try {
      const result = await callKimi({ systemPrompt, userPrompt, config });
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn(
        `Kimi API call attempt ${attempt}/${config.retries} failed: ${lastError.message}`,
      );

      if (attempt < config.retries) {
        const backoffMs = 2000 * 2 ** (attempt - 1);
        await sleep(backoffMs);
      }
    }
  }

  throw lastError || new Error("Kimi API call failed after retries");
}

async function callKimi(params: KimiCallParams): Promise<string> {
  const { systemPrompt, userPrompt, config } = params;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300000); // 300s timeout (5 minutes)

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kimi API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Kimi API returned empty content");
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Simplify item for AI processing (only send necessary fields) */
function simplifyForAI(item: McpMarketplaceItem): Record<string, unknown> {
  return {
    serverId: item.serverId,
    friendlyName: item.friendlyName,
    description: item.description,
    category: item.category,
    tags: item.tags,
    npmPackage: item.npmPackage,
    pypiPackage: item.pypiPackage,
    sseUrl: item.sseUrl,
    requiresApiKey: item.requiresApiKey,
    platforms: item.platforms,
  };
}

/** Merge AI-generated enhancements back into original items */
function mergeEnhancedData(
  original: McpMarketplaceItem[],
  aiResponse: string,
): McpMarketplaceItem[] {
  try {
    // Parse AI response (may have markdown code fences)
    const cleaned = aiResponse
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const enhanced = JSON.parse(cleaned) as Array<Record<string, unknown>>;

    if (!Array.isArray(enhanced)) {
      throw new Error("AI response is not an array");
    }

    const enhancedMap = new Map(enhanced.map((e) => [String(e.serverId), e]));

    return original.map((item) => {
      const aiData = enhancedMap.get(item.serverId);
      if (!aiData) {
        logger.warn(`No AI enhancement data for ${item.serverId}`);
        return item;
      }

      return {
        ...item,
        // AI-generated fields
        friendlyNameCn: String(aiData.friendlyNameCn || ""),
        descriptionCn: String(aiData.descriptionCn || ""),
        tagsCn: Array.isArray(aiData.tagsCn) ? (aiData.tagsCn as string[]) : [],
        availability: parseAvailability(aiData.availability),
        requirements: parseRequirements(aiData.requirements),
        categoryEnhanced: parseCategoryEnhanced(aiData.categoryEnhanced),
        aiEnhancement: {
          enhancedAt: new Date().toISOString(),
          model: "doubao-pro-128k",
          version: ENHANCEMENT_VERSION,
          recommendationScore: parseRecommendationScore(aiData.recommendationScore),
          useCaseKeywords: Array.isArray(aiData.useCaseKeywords)
            ? (aiData.useCaseKeywords as string[])
            : [],
          alternatives: Array.isArray(aiData.alternatives)
            ? (aiData.alternatives as string[])
            : undefined,
          prerequisites: Array.isArray(aiData.prerequisites)
            ? (aiData.prerequisites as string[])
            : undefined,
        },
      };
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to merge AI data: ${msg}`);
    return original; // Return original items on parse failure
  }
}

function parseAvailability(raw: unknown): McpMarketplaceItem["availability"] {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  return {
    requiresVPN: Boolean(obj.requiresVPN),
    chinaFriendlyScore: Number(obj.chinaFriendlyScore) || 0,
    chinaBlockReasons: Array.isArray(obj.chinaBlockReasons)
      ? (obj.chinaBlockReasons as string[])
      : undefined,
  };
}

function parseRequirements(raw: unknown): McpMarketplaceItem["requirements"] {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  return {
    runtimeDeps: Array.isArray(obj.runtimeDeps) ? (obj.runtimeDeps as string[]) : undefined,
    platformNotes: obj.platformNotes ? String(obj.platformNotes) : undefined,
    systemDeps: Array.isArray(obj.systemDeps) ? (obj.systemDeps as string[]) : undefined,
  };
}

function parseCategoryEnhanced(raw: unknown): McpMarketplaceItem["categoryEnhanced"] {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter((c: unknown) => c && typeof c === "object")
    .map((c: Record<string, unknown>) => ({
      category: String(c.category || ""),
      confidence: Number(c.confidence) || 0,
    }));
}

function parseRecommendationScore(
  raw: unknown,
): McpMarketplaceItem["aiEnhancement"]["recommendationScore"] {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  return {
    beginnerFriendly: Number(obj.beginnerFriendly) || 0,
    enterpriseReady: Number(obj.enterpriseReady) || 0,
    communityActivity: Number(obj.communityActivity) || 0,
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Config Helper
// ============================================================================

export function createKimiConfig(apiKey: string, overrides?: Partial<KimiConfig>): KimiConfig {
  return {
    ...DEFAULT_KIMI_CONFIG,
    apiKey,
    ...overrides,
  };
}
