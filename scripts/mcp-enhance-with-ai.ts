#!/usr/bin/env node --import tsx
/**
 * MCP Marketplace AI Enhancement Script
 *
 * Batch-enhance MCP server metadata with Kimi Code API:
 * - Chinese translation
 * - Intelligent tagging
 * - Availability assessment
 * - Dependency analysis
 * - Multi-label categorization
 * - Recommendation scores
 *
 * Usage:
 *   KIMICODE_API_KEY=sk-kimi-xxx node --import tsx scripts/mcp-enhance-with-ai.ts \
 *     --input data/mcp-index.json \
 *     --output data/mcp-index-enhanced.json \
 *     [--limit 50] \
 *     [--verbose]
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { enhanceWithKimiCode, createKimiConfig } from "../src/mcp/marketplace/ai-enhancer.js";
import type { McpMarketplaceItem } from "../src/mcp/marketplace/types.js";

// ============================================================================
// CLI Args
// ============================================================================

const { values } = parseArgs({
  options: {
    input: { type: "string", short: "i", default: "data/mcp-index.json" },
    output: { type: "string", short: "o", default: "data/mcp-index-enhanced.json" },
    limit: { type: "string", short: "l" }, // Process first N items (for testing)
    verbose: { type: "boolean", short: "v", default: false },
  },
});

const INPUT_FILE = values.input!;
const OUTPUT_FILE = values.output!;
const LIMIT = values.limit ? parseInt(values.limit, 10) : undefined;
const VERBOSE = values.verbose!;

const TEMP_DIR = "tmp-mcp-enhance";
const PROGRESS_FILE = join(TEMP_DIR, "progress.json");
const ERROR_FILE = join(TEMP_DIR, "errors.json");

// ============================================================================
// Config
// ============================================================================

// Support multiple AI API providers
const API_KEY =
  process.env.QWEN_API_KEY?.trim() ||
  process.env.DASHSCOPE_API_KEY?.trim() ||
  process.env.DOUBAO_API_KEY?.trim() ||
  process.env.ARK_API_KEY?.trim();

if (!API_KEY) {
  console.error("❌ API key not set. Please set one of:");
  console.error("   QWEN_API_KEY or DASHSCOPE_API_KEY - for Qwen API");
  console.error("   DOUBAO_API_KEY or ARK_API_KEY - for Doubao API");
  process.exit(1);
}

// Auto-detect API provider from key or env
const isQwen = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || API_KEY.startsWith("sk-");
const isDoubao = !isQwen;

let baseUrl: string;
let model: string;
let maxTokens: number;

if (isQwen) {
  // Qwen (DashScope) API configuration
  baseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1";
  model = "qwen-plus";  // 便宜又好用的模型
  maxTokens = 8192;
  console.log("🔧 Using Qwen Plus API (DashScope)");
} else {
  // Doubao uses endpoint ID as model, not a fixed model name
  const DOUBAO_ENDPOINTS = [
    "ep-m-20260203175045-ttqrg",      // Doubao-Seed-1.8-251228
    "ep-m-20260201142801-46rk9",      // Doubao-Seed-1.6
  ];
  baseUrl = "https://ark.cn-beijing.volces.com/api/v3";
  model = process.env.DOUBAO_ENDPOINT?.trim() || DOUBAO_ENDPOINTS[0];
  maxTokens = 4096;
  console.log(`🔧 Using Doubao API (endpoint: ${model})`);
}

const KIMI_CONFIG = createKimiConfig(API_KEY, {
  baseUrl,
  model,
  batchSize: 10,    // Smaller batches for faster response
  concurrency: 25,  // Very high concurrency for maximum speed
  retries: 3,
  delayMs: 300,     // Minimal delay for maximum throughput
  maxTokens,
  temperature: 0.3,
});

const CURRENT_VERSION = 1; // Enhancement version

// ============================================================================
// Main
// ============================================================================

async function main() {
  const startTime = Date.now();

  console.log("=== MCP Marketplace AI Enhancement ===");
  console.log(`Input:  ${INPUT_FILE}`);
  console.log(`Output: ${OUTPUT_FILE}`);
  if (LIMIT) console.log(`Limit:  ${LIMIT} items`);
  console.log(`Model:  ${KIMI_CONFIG.model}`);
  console.log("");

  // 1. Load input data
  if (!existsSync(INPUT_FILE)) {
    console.error(`❌ Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  const rawInput = await readFile(INPUT_FILE, "utf-8");
  const inputData = JSON.parse(rawInput) as {
    version?: number;
    itemCount?: number;
    items?: McpMarketplaceItem[];
  };

  const allItems: McpMarketplaceItem[] = Array.isArray(inputData)
    ? inputData
    : (inputData.items ?? []);

  if (allItems.length === 0) {
    console.error("❌ No items found in input file");
    process.exit(1);
  }

  console.log(`📄 Loaded ${allItems.length} items from ${INPUT_FILE}`);

  // 2. Filter already processed (resume support)
  const processedIds = new Set<string>();
  let existingData: typeof inputData | null = null;

  if (existsSync(OUTPUT_FILE)) {
    const rawOutput = await readFile(OUTPUT_FILE, "utf-8");
    existingData = JSON.parse(rawOutput) as typeof inputData;
    const existing: McpMarketplaceItem[] = Array.isArray(existingData)
      ? existingData
      : (existingData.items ?? []);

    for (const item of existing) {
      if (item.aiEnhancement?.version === CURRENT_VERSION) {
        processedIds.add(item.serverId);
      }
    }

    if (processedIds.size > 0) {
      console.log(`♻️  Found ${processedIds.size} already processed items (will skip)`);
    }
  }

  const toProcess = allItems
    .filter((i) => !processedIds.has(i.serverId))
    .slice(0, LIMIT);

  if (toProcess.length === 0) {
    console.log("✅ All items already processed!");
    process.exit(0);
  }

  console.log(`🚀 Processing ${toProcess.length} items...`);
  console.log("");

  // 3. Create temp directory
  await mkdir(TEMP_DIR, { recursive: true });

  // 4. Batch enhancement
  const result = await enhanceWithKimiCode(toProcess, KIMI_CONFIG);

  console.log("");
  console.log(`✅ Enhancement complete:`);
  console.log(`   - Enhanced: ${result.enhanced.length} items`);
  console.log(`   - Errors: ${result.errors.length} items`);

  // 5. Merge with existing data
  const existingEnhanced: McpMarketplaceItem[] = existingData
    ? (Array.isArray(existingData) ? existingData : (existingData.items ?? []))
    : [];

  const finalItems = [
    ...existingEnhanced.filter((i) => !toProcess.some((p) => p.serverId === i.serverId)),
    ...result.enhanced,
  ];

  // 6. Write output
  const outputData = {
    version: 3,
    generatedAt: new Date().toISOString(),
    itemCount: finalItems.length,
    enhancement: {
      model: KIMI_CONFIG.model,
      enhancedCount: finalItems.filter((i) => i.aiEnhancement?.version === CURRENT_VERSION).length,
      version: CURRENT_VERSION,
    },
    items: finalItems,
  };

  await mkdir(dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(outputData, null, 2), "utf-8");

  const outputSizeMB = (Buffer.byteLength(JSON.stringify(outputData), "utf-8") / 1024 / 1024).toFixed(2);
  console.log(`💾 Wrote ${OUTPUT_FILE} (${outputSizeMB} MB)`);

  // 7. Write error log
  if (result.errors.length > 0) {
    await writeFile(ERROR_FILE, JSON.stringify(result.errors, null, 2), "utf-8");
    console.log(`⚠️  Errors logged to ${ERROR_FILE}`);
  }

  // 8. Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("");
  console.log(`=== Done in ${duration}s ===`);
  console.log(`Total items: ${finalItems.length}`);
  console.log(`Enhanced: ${outputData.enhancement.enhancedCount}`);
  console.log(`Errors: ${result.errors.length}`);

  // 9. Sample output
  if (VERBOSE && result.enhanced.length > 0) {
    console.log("");
    console.log("📋 Sample enhanced item:");
    const sample = result.enhanced[0];
    console.log(JSON.stringify({
      serverId: sample.serverId,
      friendlyName: sample.friendlyName,
      friendlyNameCn: sample.friendlyNameCn,
      descriptionCn: sample.descriptionCn,
      tagsCn: sample.tagsCn,
      availability: sample.availability,
      requirements: sample.requirements,
      categoryEnhanced: sample.categoryEnhanced,
      aiEnhancement: sample.aiEnhancement,
    }, null, 2));
  }

  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err instanceof Error ? err.message : String(err));
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
