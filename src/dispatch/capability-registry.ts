/**
 * Unified Model Capability Registry — the single source of truth for model capabilities.
 *
 * This module replaces 4 fragmented capability data sources:
 *   1. BUILTIN_PROFILES in modality-router.ts (15 models × 6 capability scores)
 *   2. PROVIDER_CAPABILITY_MAPPINGS in provider-capability-mapping.ts (16 providers × string labels)
 *   3. AUTO_*_KEY_PROVIDERS in media-understanding/defaults.ts (3 priority lists)
 *   4. DEFAULT_*_MODELS in media-understanding/defaults.ts (model ID mappings)
 *
 * Design principles:
 *   - One card per model, all capability info in one place
 *   - 10 capability dimensions covering all model abilities (like human senses)
 *   - Three-layer data: built-in cards → remote update → user override
 *   - Scoring: quality only (1-5), routing policy decides priority strategy
 *   - configuredOnly filter fixes the "route to model without API key" bug
 *   - CN-only module, safe from upstream rebase
 *
 * Addresses 7 technical review findings:
 *   1. chat vs specialized model distinction via modelType field
 *   2. TTS/ASR constraints (languages, requiresDownload) separate from score
 *   3. OCR merged into vision (pdf-native tag for native PDF support)
 *   4. RoutingPolicy configurable (best-quality / cost-balanced / budget)
 *   5. Remote update with Ed25519 signature + local cache + TTL
 *   6. PI SDK modelId alignment via aliases field
 *   7. Runtime probe on first use per model+capability combo
 */

import { createSubsystemLogger } from "../logging/subsystem.js";
import { checkProviderHealth, type ProviderHealthStatus } from "./provider-health.js";

const log = createSubsystemLogger("dispatch/capability-registry");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The 10 fundamental model capabilities — like human senses + skills. */
export type CapabilityKey =
  | "text" // Think: text generation, conversation, reasoning
  | "code" // Program: code generation / understanding
  | "vision" // See: image understanding + document/PDF understanding
  | "imageGen" // Draw: text-to-image generation
  | "imageEdit" // Edit: image editing with reference image
  | "video" // Watch: video understanding
  | "videoGen" // Film: text-to-video generation
  | "audio" // Hear: ASR / speech recognition
  | "tts" // Speak: text-to-speech synthesis
  | "embedding" // Remember: vector embedding for storage & retrieval
  | "toolCall"; // Use tools: function calling / MCP

/** Quality scores: 1-5 within each dimension. Only comparable within same dimension. */
export type CapabilityScores = Partial<Record<CapabilityKey, number>>;

/** Whether a model is a multi-capability chat model or a single-purpose specialist. */
export type ModelType = "chat" | "specialized";

/** Cost tier for quick classification. */
export type CostTier = "premium" | "standard" | "free";

/** Network accessibility region. */
export type ModelRegion = "domestic" | "international";

/** Routing policy — determines how candidates are ranked. */
export type RoutingPolicy = "best-quality" | "cost-balanced" | "budget";

/**
 * Model strength/quality tier for user-facing UI warnings.
 *
 * - "strong"  : Flagship models (text >= 4 or code >= 4). No warnings.
 * - "moderate": Mid-range models (text >= 3 or code >= 3). Mild advisory.
 * - "weak"    : Small/limited models. Show warning recommending stronger models.
 */
export type ModelStrengthTier = "strong" | "moderate" | "weak";

/**
 * A model's complete capability card — the atomic unit of the registry.
 *
 * One card per model. Contains everything needed to decide whether and when
 * to use this model for a given task.
 */
export interface ModelCapabilityCard {
  // ── Identity ──
  /** Provider identifier, matches models.json / auth-profiles (e.g., "openai", "deepseek"). */
  provider: string;
  /** Model identifier as used in API calls (e.g., "gpt-4o", "deepseek-chat"). */
  modelId: string;
  /** Human-readable display name (e.g., "GPT-4o", "DeepSeek V3"). */
  displayName: string;
  /** Alternative model IDs that should match this card (PI SDK alignment). */
  aliases?: string[];

  // ── Capability scores ──
  /** Quality scores 1-5 per capability. Absent key = not supported. */
  capabilities: CapabilityScores;

  // ── Classification ──
  /** Chat model (multi-capability like GPT-4o) vs specialized (single-purpose like DALL-E 3). */
  modelType: ModelType;
  /** Network region: domestic (low latency, compliant) or international (may need proxy). */
  region: ModelRegion;
  /** Cost classification. */
  costTier: CostTier;
  /** Total cost per 1M tokens in USD (input + output). 0 for free models. */
  costPer1M: number;

  // ── Constraints ──
  /** Supported languages (ISO 639-1). Relevant for TTS/ASR. Empty = all. */
  languages?: string[];
  /** Whether the model requires a local download before use (e.g., SenseVoice, GGUF). */
  requiresDownload?: boolean;
  /** Max context window in tokens. */
  maxContextTokens?: number;
  /** TTS engine identifier (for TTS models only). */
  ttsEngine?: string;
  /** Available TTS voices (for TTS models only). */
  ttsVoices?: string[];
  /** Descriptive tags for filtering (e.g., "pdf-native", "chinese-optimized", "long-context"). */
  tags?: string[];
  /** Explicit strength tier override. When set by remote cards, takes precedence over score-based derivation. */
  strengthTier?: ModelStrengthTier;
  /** Embedding output dimension count (embedding models only). Used for vec binding compatibility checks. */
  embeddingDims?: number;
}

/**
 * Runtime state for a model — assembled dynamically, not persisted in cards.
 */
export interface ModelRuntimeState {
  /** Whether the user has configured API credentials for this provider. */
  configured: boolean;
  /** Provider health status from the health monitor. */
  health: ProviderHealthStatus;
  /** Whether a specific capability has been validated at runtime. */
  probeResults: Partial<Record<CapabilityKey, "verified" | "failed" | "untested">>;
}

/** A capability card enriched with its current runtime state. */
export interface EnrichedCard extends ModelCapabilityCard {
  runtime: ModelRuntimeState;
}

/** Query filter options for the registry. */
export interface RegistryQueryFilter {
  /** Only return models where the user has configured API credentials. Default: false. */
  configuredOnly?: boolean;
  /** Only return domestic models. Default: false. */
  domesticOnly?: boolean;
  /** Only return healthy providers (skip "down"). Default: true. */
  healthyOnly?: boolean;
  /** Only return models that have been probe-verified for the queried capability. Default: false. */
  verifiedOnly?: boolean;
  /** Required tags (all must match). */
  tags?: string[];
}

/** Summary of the user's current capability coverage. */
export interface CapabilityMatrixSummary {
  available: Array<{ capability: CapabilityKey; bestCard: EnrichedCard; alternatives: number }>;
  missing: CapabilityKey[];
  unconfigured: Array<{ capability: CapabilityKey; recommendation: ModelCapabilityCard }>;
}

// ---------------------------------------------------------------------------
// Built-in capability cards — ships with every release
// ---------------------------------------------------------------------------

/**
 * Built-in model capability cards.
 *
 * Scoring guidelines (within each capability dimension):
 *   5 = Best-in-class (e.g., Claude Opus for text/code, GPT-4o for vision)
 *   4 = Excellent (top tier domestic or strong international)
 *   3 = Good (solid performance, acceptable for most tasks)
 *   2 = Fair (basic capability, noticeable quality gap)
 *   1 = Minimal (barely functional, last resort)
 *
 * Priority strategy (effect-first for startup product):
 *   International top-tier (if user has key) → Domestic top-tier (paid)
 *   → Domestic free (SiliconFlow fallback)
 *   This is enforced by the routing policy + scores, not hardcoded order.
 */
export const BUILTIN_CAPABILITY_CARDS: ModelCapabilityCard[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // International — Top-tier quality
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Anthropic ──
  {
    provider: "anthropic",
    modelId: "claude-opus-4-6",
    displayName: "Claude Opus 4.6",
    aliases: ["claude-opus-4-20250514"],
    capabilities: { text: 5, code: 5, vision: 4, toolCall: 5 },
    modelType: "chat",
    region: "international",
    costTier: "premium",
    costPer1M: 90.0,
    maxContextTokens: 200_000,
    tags: ["pdf-native"],
  },
  {
    provider: "anthropic",
    modelId: "claude-sonnet-4-5",
    displayName: "Claude Sonnet 4.5",
    aliases: ["claude-sonnet-4-5-20250514"],
    capabilities: { text: 5, code: 5, vision: 4, toolCall: 5 },
    modelType: "chat",
    region: "international",
    costTier: "premium",
    costPer1M: 18.0,
    maxContextTokens: 200_000,
    tags: ["pdf-native"],
  },
  {
    provider: "anthropic",
    modelId: "claude-haiku-4-5",
    displayName: "Claude Haiku 4.5",
    aliases: ["claude-haiku-4-5-20251001"],
    capabilities: { text: 4, code: 4, vision: 3, toolCall: 4 },
    modelType: "chat",
    region: "international",
    costTier: "standard",
    costPer1M: 4.0,
    maxContextTokens: 200_000,
  },

  // ── OpenAI ──
  {
    provider: "openai",
    modelId: "gpt-4o",
    displayName: "GPT-4o",
    capabilities: { text: 4, code: 4, vision: 5, audio: 4, video: 3, imageGen: 3, toolCall: 5 },
    modelType: "chat",
    region: "international",
    costTier: "premium",
    costPer1M: 12.5,
    maxContextTokens: 128_000,
    tags: ["pdf-native"],
  },
  {
    provider: "openai",
    modelId: "gpt-4o-mini",
    displayName: "GPT-4o Mini",
    capabilities: { text: 3, code: 3, vision: 3, toolCall: 4 },
    modelType: "chat",
    region: "international",
    costTier: "standard",
    costPer1M: 0.75,
    maxContextTokens: 128_000,
  },
  {
    provider: "openai",
    modelId: "dall-e-3",
    displayName: "DALL-E 3",
    capabilities: { imageGen: 5 },
    modelType: "specialized",
    region: "international",
    costTier: "premium",
    costPer1M: 80.0, // ~$0.08 per image, normalized
  },
  {
    provider: "openai",
    modelId: "gpt-image-1",
    displayName: "GPT Image",
    capabilities: { imageGen: 5 },
    modelType: "specialized",
    region: "international",
    costTier: "premium",
    costPer1M: 40.0,
  },
  {
    provider: "openai",
    modelId: "tts-1",
    displayName: "OpenAI TTS",
    capabilities: { tts: 5 },
    modelType: "specialized",
    region: "international",
    costTier: "premium",
    costPer1M: 15.0,
    ttsEngine: "openai",
    languages: ["en", "zh", "ja", "ko", "de", "fr", "es", "pt", "it", "nl", "pl", "ru"],
    ttsVoices: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
  },
  {
    provider: "openai",
    modelId: "gpt-4o-mini-transcribe",
    displayName: "GPT-4o Mini Transcribe",
    capabilities: { audio: 5 },
    modelType: "specialized",
    region: "international",
    costTier: "standard",
    costPer1M: 3.0,
    languages: ["en", "zh", "ja", "ko", "de", "fr", "es"],
  },
  {
    provider: "openai",
    modelId: "text-embedding-3-large",
    displayName: "OpenAI Embedding Large",
    aliases: ["text-embedding-3-small"],
    capabilities: { embedding: 5 },
    modelType: "specialized",
    region: "international",
    costTier: "standard",
    costPer1M: 0.13,
    embeddingDims: 3072,
  },

  // ── Google ──
  {
    provider: "google",
    modelId: "gemini-2.0-flash",
    displayName: "Gemini 2.0 Flash",
    aliases: ["gemini-2.0-flash-001"],
    capabilities: { text: 4, code: 3, vision: 4, audio: 3, video: 4, toolCall: 4 },
    modelType: "chat",
    region: "international",
    costTier: "standard",
    costPer1M: 1.5,
    tags: ["pdf-native", "long-context"],
    maxContextTokens: 1_000_000,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Domestic — Top-tier (paid)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── DeepSeek ──
  {
    provider: "deepseek",
    modelId: "deepseek-chat",
    displayName: "DeepSeek V3",
    aliases: ["deepseek-v3"],
    capabilities: { text: 4, code: 5 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 1.37,
    maxContextTokens: 131_072, // 官方标称 128K
    tags: ["chinese-optimized"],
  },
  {
    provider: "deepseek",
    modelId: "deepseek-v3.2",
    displayName: "DeepSeek V3.2",
    aliases: ["deepseek/deepseek-v3.2"],
    capabilities: { text: 4, code: 5, toolCall: 4 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 0.64,
    maxContextTokens: 163_840,
    tags: ["chinese-optimized"],
  },
  {
    provider: "deepseek",
    modelId: "deepseek-v3.2-speciale",
    displayName: "DeepSeek V3.2 SpecialE",
    aliases: ["deepseek/deepseek-v3.2-speciale"],
    capabilities: { text: 5, code: 5, toolCall: 4 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 1.6,
    maxContextTokens: 163_840,
    tags: ["chinese-optimized"],
  },
  {
    provider: "deepseek",
    modelId: "deepseek-reasoner",
    displayName: "DeepSeek R1",
    aliases: ["deepseek-r1"],
    capabilities: { text: 5, code: 5 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 6.27,
    maxContextTokens: 131_072, // 官方标称 128K
    tags: ["chinese-optimized"],
  },

  // ── Qwen (Alibaba) ──
  {
    provider: "qwen",
    modelId: "qwen-vl-max",
    displayName: "千问 VL-Max",
    aliases: ["qwen-vl-max-latest"],
    capabilities: { text: 4, code: 3, vision: 4 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 12.0,
    maxContextTokens: 131_072, // 官方标称 128K
    tags: ["pdf-native", "chinese-optimized"],
  },
  {
    provider: "qwen",
    modelId: "qwen-max",
    displayName: "千问 Max",
    aliases: ["qwen-max-latest"],
    capabilities: { text: 4, code: 4, toolCall: 4 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 5.6,
    maxContextTokens: 32_768,
    tags: ["chinese-optimized"],
  },
  {
    provider: "qwen",
    modelId: "qwen-turbo",
    displayName: "千问 Turbo",
    aliases: ["qwen-turbo-latest"],
    capabilities: { text: 3, code: 3, toolCall: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 0.4,
    maxContextTokens: 131_072,
    tags: ["chinese-optimized"],
  },
  {
    provider: "qwen",
    modelId: "text-embedding-v3",
    displayName: "千问 Embedding V3",
    capabilities: { embedding: 4 },
    modelType: "specialized",
    region: "domestic",
    costTier: "standard",
    costPer1M: 0.7,
    embeddingDims: 1024,
  },

  // ── Zhipu (GLM) ──
  {
    provider: "zhipu",
    modelId: "glm-4v-plus",
    displayName: "智谱 GLM-4V Plus",
    aliases: ["glm-4v-plus-0111"],
    capabilities: { text: 3, vision: 3, toolCall: 4 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 8.0,
    maxContextTokens: 128_000,
    tags: ["chinese-optimized"],
  },
  {
    provider: "zhipu",
    modelId: "glm-4-plus",
    displayName: "智谱 GLM-4 Plus",
    aliases: ["glm-4-plus-0111"],
    capabilities: { text: 3, code: 3, toolCall: 4 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 2.0,
    maxContextTokens: 128_000,
    tags: ["chinese-optimized"],
  },
  {
    provider: "zhipu",
    modelId: "glm-4-flash",
    displayName: "智谱 GLM-4 Flash",
    capabilities: { text: 2, code: 2 },
    modelType: "chat",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
    maxContextTokens: 128_000,
    tags: ["chinese-optimized"],
  },

  // ── Doubao (ByteDance) ──
  {
    provider: "doubao",
    modelId: "doubao-seed-1-8-251228",
    displayName: "豆包 Seed 1.8",
    capabilities: { text: 4, code: 3, vision: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 0.4,
    maxContextTokens: 256_000,
    tags: ["chinese-optimized"],
  },

  // ── Moonshot (Kimi) ──
  {
    provider: "moonshot",
    modelId: "moonshot-v1-auto",
    displayName: "Kimi Moonshot",
    capabilities: { text: 3, code: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 4.0,
    maxContextTokens: 128_000,
    tags: ["long-context", "chinese-optimized"],
  },

  // ── MiniMax ──
  {
    provider: "minimax",
    modelId: "MiniMax-VL-01",
    displayName: "MiniMax VL-01",
    capabilities: { text: 3, vision: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 4.0,
    maxContextTokens: 200_000,
    tags: ["chinese-optimized"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Domestic — Free tier (SiliconFlow + others)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    provider: "siliconflow",
    modelId: "deepseek-ai/DeepSeek-V3",
    displayName: "SiliconFlow DeepSeek V3",
    capabilities: { text: 4, code: 5 },
    modelType: "chat",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
    maxContextTokens: 131_072, // 官方标称 128K
    tags: ["chinese-optimized"],
  },
  {
    provider: "siliconflow",
    modelId: "Qwen/Qwen2-VL-72B-Instruct",
    displayName: "SiliconFlow Qwen2-VL-72B",
    aliases: ["Qwen2-VL-72B-Instruct", "Qwen/Qwen2-VL-72B"],
    capabilities: { text: 3, vision: 3, video: 2 },
    modelType: "chat",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
    maxContextTokens: 32_768,
    tags: ["chinese-optimized"],
  },
  {
    provider: "siliconflow",
    modelId: "Qwen/Qwen-VL-Plus",
    displayName: "SiliconFlow Qwen-VL-Plus",
    aliases: ["Qwen-VL-Plus", "qwen-vl-plus"],
    capabilities: { text: 3, vision: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 3.0,
    maxContextTokens: 131_072,
    tags: ["chinese-optimized"],
  },
  {
    provider: "siliconflow",
    modelId: "black-forest-labs/FLUX.1-schnell",
    displayName: "SiliconFlow FLUX.1",
    aliases: ["FLUX.1-schnell"],
    capabilities: { imageGen: 4 },
    modelType: "specialized",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
  },
  {
    provider: "siliconflow",
    modelId: "BAAI/bge-m3",
    displayName: "BGE-M3",
    aliases: ["bge-m3"],
    capabilities: { embedding: 4 },
    modelType: "specialized",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
    tags: ["multilingual"],
    embeddingDims: 1024,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Domestic — Image Generation (specialized)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Volcengine Seedream (豆包画图) ──
  // Uses volcengine-ark provider ID to match auth system (same API key as Doubao chat models)
  {
    provider: "volcengine-ark",
    modelId: "doubao-seedream-4-0",
    displayName: "豆包 Seedream 4.0",
    capabilities: { imageGen: 5 },
    modelType: "specialized",
    region: "domestic",
    costTier: "standard",
    costPer1M: 10.0,
    tags: ["chinese-optimized"],
  },

  // ── Zhipu CogView (智谱画图) ──
  {
    provider: "zhipu",
    modelId: "cogview-4-plus",
    displayName: "智谱 CogView-4 Plus",
    capabilities: { imageGen: 4 },
    modelType: "specialized",
    region: "domestic",
    costTier: "standard",
    costPer1M: 8.0,
    tags: ["chinese-optimized"],
  },
  {
    provider: "zhipu",
    modelId: "cogview-4",
    displayName: "智谱 CogView-4",
    aliases: ["cogview-4-250304"],
    capabilities: { imageGen: 3 },
    modelType: "specialized",
    region: "domestic",
    costTier: "standard",
    costPer1M: 5.0,
    tags: ["chinese-optimized"],
  },

  // ── DashScope Wanx (通义万相) ──
  {
    provider: "dashscope",
    modelId: "wanx-v1",
    displayName: "通义万相 Wanx-v1",
    capabilities: { imageGen: 4 },
    modelType: "specialized",
    region: "domestic",
    costTier: "standard",
    costPer1M: 0.5,
    tags: ["chinese-optimized"],
  },
  {
    provider: "dashscope",
    modelId: "wanx2.1-t2i-turbo",
    displayName: "通义万相 Wanx2.1 Turbo",
    capabilities: { imageGen: 5 },
    modelType: "specialized",
    region: "domestic",
    costTier: "standard",
    costPer1M: 1.0,
    tags: ["chinese-optimized"],
  },

  // ── SiliconFlow SDXL ──
  {
    provider: "siliconflow",
    modelId: "stabilityai/stable-diffusion-xl-base-1.0",
    displayName: "SiliconFlow SDXL",
    aliases: ["sdxl-base-1.0"],
    capabilities: { imageGen: 3 },
    modelType: "specialized",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
  },

  // ── Local sd.cpp ──
  {
    provider: "local",
    modelId: "sd-cpp",
    displayName: "Local SD (sd.cpp)",
    capabilities: { imageGen: 3 },
    modelType: "specialized",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
    tags: ["local", "offline"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Domestic — Video Generation (specialized)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Zhipu CogVideoX (智谱视频) ──
  {
    provider: "zhipu",
    modelId: "cogvideox-flash",
    displayName: "智谱 CogVideoX Flash",
    capabilities: { videoGen: 3 },
    modelType: "specialized",
    region: "domestic",
    costTier: "standard",
    costPer1M: 5.0,
    tags: ["chinese-optimized"],
  },
  {
    provider: "zhipu",
    modelId: "cogvideox",
    displayName: "智谱 CogVideoX",
    capabilities: { videoGen: 4 },
    modelType: "specialized",
    region: "domestic",
    costTier: "standard",
    costPer1M: 10.0,
    tags: ["chinese-optimized"],
  },

  // ── SiliconFlow video models ──
  {
    provider: "siliconflow",
    modelId: "Pro/THUDM/CogVideoX-5B",
    displayName: "SiliconFlow CogVideoX-5B",
    capabilities: { videoGen: 3 },
    modelType: "specialized",
    region: "domestic",
    costTier: "standard",
    costPer1M: 8.0,
  },
  {
    provider: "siliconflow",
    modelId: "Wan-AI/Wan2.2-T2V-A14B",
    displayName: "SiliconFlow Wan2.2 视频生成",
    capabilities: { videoGen: 5 },
    modelType: "specialized",
    region: "domestic",
    costTier: "standard",
    costPer1M: 6.0,
  },
  {
    provider: "siliconflow",
    modelId: "Wan-AI/Wan2.1-T2V-14B-720P",
    displayName: "SiliconFlow Wan2.1 视频生成 720P",
    capabilities: { videoGen: 4 },
    modelType: "specialized",
    region: "domestic",
    costTier: "standard",
    costPer1M: 6.0,
  },
  {
    provider: "siliconflow",
    modelId: "Wan-AI/Wan2.2-I2V-A14B",
    displayName: "SiliconFlow Wan2.2 图生视频",
    capabilities: { videoGen: 5 },
    modelType: "specialized",
    region: "domestic",
    costTier: "standard",
    costPer1M: 6.0,
    tags: ["chinese-optimized"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Local models — zero cost, may require download
  // ═══════════════════════════════════════════════════════════════════════════

  {
    provider: "local",
    modelId: "sensevoice-small",
    displayName: "SenseVoice (本地)",
    capabilities: { audio: 4 },
    modelType: "specialized",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
    requiresDownload: true,
    languages: ["zh", "en", "ja", "ko"],
    tags: ["chinese-optimized"],
  },
  {
    provider: "local",
    modelId: "edge-tts",
    displayName: "Edge TTS (免费)",
    capabilities: { tts: 3 },
    modelType: "specialized",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
    ttsEngine: "edge",
    languages: ["zh", "en", "ja", "ko", "de", "fr", "es"],
    ttsVoices: ["zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural", "en-US-MichelleNeural"],
  },
  {
    provider: "local",
    modelId: "qwen3-asr-0.6b",
    displayName: "Qwen3 ASR (本地 GPU)",
    capabilities: { audio: 4 },
    modelType: "specialized",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
    requiresDownload: true,
    languages: ["zh", "en", "ja", "ko"],
    tags: ["gpu-required", "chinese-optimized"],
  },
  {
    provider: "local",
    modelId: "qwen3-tts-0.6b",
    displayName: "Qwen3 TTS (本地 GPU)",
    capabilities: { tts: 4 },
    modelType: "specialized",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
    requiresDownload: true,
    ttsEngine: "qwen3",
    languages: ["zh", "en"],
    tags: ["gpu-required"],
  },
  {
    provider: "local",
    modelId: "kokoro-82m",
    displayName: "Kokoro TTS (本地 CPU)",
    capabilities: { tts: 3 },
    modelType: "specialized",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
    requiresDownload: true,
    ttsEngine: "kokoro",
    languages: ["zh", "en", "ja"],
    tags: ["cpu-friendly"],
  },

  // ── Groq (ASR specialist) ──
  {
    provider: "groq",
    modelId: "whisper-large-v3-turbo",
    displayName: "Whisper Large V3 Turbo",
    capabilities: { audio: 5 },
    modelType: "specialized",
    region: "international",
    costTier: "free",
    costPer1M: 0.0,
    languages: ["en", "zh", "ja", "ko", "de", "fr", "es"],
  },

  // ── Deepgram ──
  {
    provider: "deepgram",
    modelId: "nova-3",
    displayName: "Deepgram Nova-3",
    capabilities: { audio: 4 },
    modelType: "specialized",
    region: "international",
    costTier: "standard",
    costPer1M: 4.0,
    languages: ["en", "zh", "es"],
  },

  // ── ElevenLabs ──
  {
    provider: "elevenlabs",
    modelId: "eleven_multilingual_v2",
    displayName: "ElevenLabs TTS",
    capabilities: { tts: 5 },
    modelType: "specialized",
    region: "international",
    costTier: "premium",
    costPer1M: 30.0,
    ttsEngine: "elevenlabs",
    languages: ["en", "zh", "ja", "ko", "de", "fr", "es"],
  },

  // ── NVIDIA NIM ──
  {
    provider: "nvidia",
    modelId: "nvidia/llama-3.1-nemotron-70b-instruct",
    displayName: "Llama 3.1 Nemotron 70B",
    capabilities: { text: 3, code: 3 },
    modelType: "chat",
    region: "international",
    costTier: "standard",
    costPer1M: 2.0,
    maxContextTokens: 128_000,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Domestic — Additional providers
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Kimi Coding (月之暗面代码专用) ──
  {
    provider: "kimi-coding",
    modelId: "kimi-for-coding",
    displayName: "Kimi for Coding",
    capabilities: { text: 4, code: 5, vision: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 2.0,
    maxContextTokens: 262_144,
    tags: ["long-context", "chinese-optimized"],
  },

  // ── Doubao additional models (ByteDance) ──
  {
    provider: "doubao",
    modelId: "doubao-seed-1-6-251015",
    displayName: "豆包 Seed 1.6",
    capabilities: { text: 3, code: 3, vision: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 0.3,
    maxContextTokens: 256_000,
    tags: ["chinese-optimized"],
  },
  {
    provider: "doubao",
    modelId: "doubao-seed-1-6-lite-251015",
    displayName: "豆包 Seed 1.6 Lite",
    capabilities: { text: 3, code: 2 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 0.15,
    maxContextTokens: 256_000,
    tags: ["chinese-optimized"],
  },
  {
    provider: "doubao",
    modelId: "doubao-seed-1-6-flash-250828",
    displayName: "豆包 Seed 1.6 Flash",
    capabilities: { text: 3, code: 2 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 0.1,
    maxContextTokens: 256_000,
    tags: ["chinese-optimized"],
  },

  // ── Qwen additional models ──
  {
    provider: "qwen",
    modelId: "qwen3.5-plus",
    displayName: "千问 3.5 Plus",
    aliases: ["qwen/qwen3.5-plus-02-15"],
    capabilities: { text: 5, code: 4, vision: 4 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 2.4,
    maxContextTokens: 1_000_000,
    tags: ["long-context", "chinese-optimized"],
  },
  {
    provider: "qwen",
    modelId: "qwen3-max-thinking",
    displayName: "千问 3 Max Thinking",
    aliases: ["qwen/qwen3-max-thinking"],
    capabilities: { text: 5, code: 4 },
    modelType: "chat",
    region: "domestic",
    costTier: "premium",
    costPer1M: 7.2,
    maxContextTokens: 262_144,
    tags: ["chinese-optimized"],
  },
  {
    provider: "qwen",
    modelId: "qwen3-coder-next",
    displayName: "千问 3 Coder Next",
    aliases: ["qwen/qwen3-coder-next"],
    capabilities: { text: 3, code: 5 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 0.87,
    maxContextTokens: 262_144,
    tags: ["chinese-optimized"],
  },
  {
    provider: "qwen",
    modelId: "qwen-plus",
    displayName: "千问 Plus",
    aliases: ["qwen-plus-latest"],
    capabilities: { text: 4, code: 3, toolCall: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 1.6,
    maxContextTokens: 131_072,
    tags: ["chinese-optimized"],
  },
  {
    provider: "qwen",
    modelId: "qwen-vl-plus",
    displayName: "千问 VL-Plus",
    aliases: ["qwen-vl-plus-latest"],
    capabilities: { text: 3, vision: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 3.0,
    maxContextTokens: 131_072,
    tags: ["chinese-optimized"],
  },

  // ── Zhipu additional models ──
  {
    provider: "zhipu",
    modelId: "glm-4.6v",
    displayName: "智谱 GLM-4.6V",
    capabilities: { text: 3, vision: 4 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 5.0,
    maxContextTokens: 128_000,
    tags: ["chinese-optimized"],
  },
  {
    provider: "zhipu",
    modelId: "glm-4.5v",
    displayName: "智谱 GLM-4.5V",
    capabilities: { text: 3, vision: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 3.0,
    maxContextTokens: 128_000,
    tags: ["chinese-optimized"],
  },
  {
    provider: "zhipu",
    modelId: "glm-4.7-flash",
    displayName: "智谱 GLM-4.7 Flash",
    capabilities: { text: 3, code: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
    maxContextTokens: 128_000,
    tags: ["chinese-optimized"],
  },
  {
    provider: "zhipu",
    modelId: "glm-4.7",
    displayName: "智谱 GLM-4.7",
    capabilities: { text: 3, code: 3, toolCall: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 3.0,
    maxContextTokens: 128_000,
    tags: ["chinese-optimized"],
  },
  {
    provider: "zhipu",
    modelId: "glm-4.6",
    displayName: "智谱 GLM-4.6",
    capabilities: { text: 3, code: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 3.0,
    maxContextTokens: 128_000,
    tags: ["chinese-optimized"],
  },
  {
    provider: "zhipu",
    modelId: "glm-4.5",
    displayName: "智谱 GLM-4.5",
    capabilities: { text: 3, code: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 2.0,
    maxContextTokens: 128_000,
    tags: ["chinese-optimized"],
  },
  {
    provider: "zhipu",
    modelId: "glm-4.5-flash",
    displayName: "智谱 GLM-4.5 Flash",
    capabilities: { text: 2, code: 2 },
    modelType: "chat",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
    maxContextTokens: 128_000,
    tags: ["chinese-optimized"],
  },
  {
    provider: "zhipu",
    modelId: "glm-4.5-air",
    displayName: "智谱 GLM-4.5 Air",
    capabilities: { text: 2, code: 2 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 1.0,
    maxContextTokens: 128_000,
    tags: ["chinese-optimized"],
  },
  {
    provider: "zhipu",
    modelId: "glm-5",
    displayName: "智谱 GLM-5",
    capabilities: { text: 4, code: 4, toolCall: 4 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 6.0,
    maxContextTokens: 128_000,
    tags: ["chinese-optimized"],
  },
  {
    provider: "zhipu",
    modelId: "glm-5-code",
    displayName: "智谱 GLM-5-Code",
    capabilities: { text: 3, code: 4 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 6.0,
    maxContextTokens: 128_000,
    tags: ["chinese-optimized"],
  },
  {
    provider: "zhipu",
    modelId: "embedding-3",
    displayName: "智谱 Embedding-3",
    capabilities: { embedding: 4 },
    modelType: "specialized",
    region: "domestic",
    costTier: "standard",
    costPer1M: 0.5,
    embeddingDims: 2048,
  },

  // ── Tencent Hunyuan (腾讯混元) ──
  {
    provider: "tencent-hunyuan",
    modelId: "hunyuan-pro",
    displayName: "混元 Pro",
    capabilities: { text: 3, code: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 4.0,
    maxContextTokens: 32_000,
    tags: ["chinese-optimized"],
  },
  {
    provider: "tencent-hunyuan",
    modelId: "hunyuan-lite",
    displayName: "混元 Lite",
    capabilities: { text: 2, code: 2 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 1.0,
    maxContextTokens: 256_000,
    tags: ["long-context", "chinese-optimized"],
  },
  {
    provider: "tencent-hunyuan",
    modelId: "hunyuan-vision",
    displayName: "混元 Vision",
    capabilities: { text: 3, vision: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 5.0,
    maxContextTokens: 32_000,
    tags: ["chinese-optimized"],
  },

  // ── Ant Ling (蚂蚁百灵) ──
  {
    provider: "ant-ling",
    modelId: "ling-1t",
    displayName: "百灵 Ling-1T",
    capabilities: { text: 3, code: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
    maxContextTokens: 128_000,
    tags: ["chinese-optimized"],
  },
  {
    provider: "ant-ling",
    modelId: "ring-1t",
    displayName: "百灵 Ring-1T",
    capabilities: { text: 3, code: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
    maxContextTokens: 128_000,
    tags: ["chinese-optimized"],
  },
  {
    provider: "ant-ling",
    modelId: "ming-flash-omni",
    displayName: "百灵 Ming-Flash-Omni",
    capabilities: { text: 3, vision: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
    maxContextTokens: 128_000,
    tags: ["chinese-optimized"],
  },

  // ── Meituan LongCat (美团) ──
  {
    provider: "meituan-longcat",
    modelId: "longcat-flash-chat",
    displayName: "LongCat Flash",
    capabilities: { text: 3, code: 2 },
    modelType: "chat",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
    maxContextTokens: 131_072,
    tags: ["long-context", "chinese-optimized"],
  },

  // ── SiliconFlow additional models ──
  {
    provider: "siliconflow",
    modelId: "Pro/moonshotai/Kimi-K2.5",
    displayName: "Kimi-K2.5 Pro (硅基流动)",
    capabilities: { text: 4, code: 4 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 1.0,
    maxContextTokens: 2_000_000, // 官方标称 200 万
    tags: ["chinese-optimized"],
  },
  {
    provider: "siliconflow",
    modelId: "Qwen/Qwen2.5-7B-Instruct",
    displayName: "SiliconFlow Qwen2.5-7B (免费)",
    capabilities: { text: 2, code: 2 },
    modelType: "chat",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
    maxContextTokens: 32_768,
    tags: ["chinese-optimized"],
  },
  {
    provider: "siliconflow",
    modelId: "stabilityai/stable-diffusion-3-5-large",
    displayName: "SiliconFlow SD 3.5 Large",
    capabilities: { imageGen: 3 },
    modelType: "specialized",
    region: "domestic",
    costTier: "standard",
    costPer1M: 5.0,
  },
  {
    provider: "siliconflow",
    modelId: "Qwen/Qwen-Image",
    displayName: "Qwen-Image (通义生图)",
    aliases: ["qwen-image"],
    capabilities: { imageGen: 4 },
    modelType: "specialized",
    region: "domestic",
    costTier: "standard",
    costPer1M: 3.0,
    tags: ["chinese-optimized"],
  },
  {
    provider: "siliconflow",
    modelId: "Qwen/Qwen-Image-Edit",
    displayName: "Qwen-Image-Edit (图像编辑)",
    aliases: ["qwen-image-edit"],
    capabilities: { imageEdit: 4 },
    modelType: "specialized",
    region: "domestic",
    costTier: "standard",
    costPer1M: 3.0,
    tags: ["chinese-optimized"],
  },
  {
    provider: "siliconflow",
    modelId: "Kwai-Kolors/Kolors",
    displayName: "Kolors (可图)",
    aliases: ["kolors"],
    capabilities: { imageGen: 3 },
    modelType: "specialized",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
    tags: ["chinese-optimized"],
  },
  {
    provider: "siliconflow",
    modelId: "Qwen/Qwen2-VL-7B-Instruct",
    displayName: "SiliconFlow Qwen2-VL-7B (免费)",
    capabilities: { text: 2, vision: 2, video: 2 },
    modelType: "chat",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
    maxContextTokens: 32_768,
    tags: ["chinese-optimized"],
  },

  // ── Moonshot additional models ──
  {
    provider: "moonshot",
    modelId: "kimi-k2.5",
    displayName: "Kimi K2.5",
    aliases: ["moonshotai/kimi-k2.5"],
    capabilities: { text: 4, code: 4, vision: 3, toolCall: 4 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 2.7,
    maxContextTokens: 2_000_000, // 官方标称 200 万
    tags: ["chinese-optimized"],
  },
  {
    provider: "moonshot",
    modelId: "kimi-k2-thinking",
    displayName: "Kimi K2 Thinking",
    aliases: ["moonshotai/kimi-k2-thinking"],
    capabilities: { text: 4, code: 4, toolCall: 4 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 2.5,
    maxContextTokens: 131_072,
    tags: ["chinese-optimized"],
  },
  {
    provider: "moonshot",
    modelId: "moonshot-v1-128k",
    displayName: "Kimi Moonshot 128K",
    capabilities: { text: 3, code: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 16.0,
    maxContextTokens: 128_000,
    tags: ["long-context", "chinese-optimized"],
  },

  // ── MiniMax additional models ──
  {
    provider: "minimax",
    modelId: "MiniMax-M2.5",
    displayName: "MiniMax M2.5",
    capabilities: { text: 4, code: 3, toolCall: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 3.0,
    maxContextTokens: 200_000,
    tags: ["long-context", "chinese-optimized"],
  },
  {
    provider: "minimax",
    modelId: "MiniMax-M2.5-highspeed",
    displayName: "MiniMax M2.5 Highspeed",
    capabilities: { text: 4, code: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 3.0,
    maxContextTokens: 200_000,
    tags: ["long-context", "chinese-optimized"],
  },
  {
    provider: "minimax",
    modelId: "MiniMax-M2.1",
    displayName: "MiniMax M2.1",
    capabilities: { text: 3, code: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 2.0,
    maxContextTokens: 200_000,
    tags: ["chinese-optimized"],
  },
  {
    provider: "minimax",
    modelId: "MiniMax-M2.1-highspeed",
    displayName: "MiniMax M2.1 Highspeed",
    capabilities: { text: 3, code: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 2.0,
    maxContextTokens: 200_000,
    tags: ["chinese-optimized"],
  },
  {
    provider: "minimax",
    modelId: "MiniMax-M2",
    displayName: "MiniMax M2",
    capabilities: { text: 3, code: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 1.5,
    maxContextTokens: 200_000,
    tags: ["chinese-optimized"],
  },
  {
    provider: "minimax",
    modelId: "MiniMax-M2.1-Video",
    displayName: "MiniMax M2.1 Video",
    capabilities: { text: 3, video: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 5.0,
    maxContextTokens: 200_000,
    tags: ["chinese-optimized"],
  },
  {
    provider: "minimax",
    modelId: "MiniMax-M2-Her",
    displayName: "MiniMax M2 Her",
    aliases: ["minimax/minimax-m2-her"],
    capabilities: { text: 3, code: 2 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 1.5,
    maxContextTokens: 65_536,
    tags: ["chinese-optimized"],
  },
  {
    provider: "minimax",
    modelId: "MiniMax-Text-Embedding-v1",
    displayName: "MiniMax Embedding V1",
    capabilities: { embedding: 3 },
    modelType: "specialized",
    region: "domestic",
    costTier: "standard",
    costPer1M: 0.5,
    embeddingDims: 1536,
  },

  // ── StepFun (阶跃星辰) ──
  {
    provider: "stepfun",
    modelId: "step-3.5-flash",
    displayName: "StepFun 3.5 Flash",
    aliases: ["stepfun/step-3.5-flash"],
    capabilities: { text: 3, code: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "standard",
    costPer1M: 0.4,
    maxContextTokens: 256_000,
    tags: ["long-context", "chinese-optimized"],
  },

  // ── Ollama (local, dynamic, representative cards) ──
  {
    provider: "ollama",
    modelId: "llama3.3:latest",
    displayName: "Ollama Llama 3.3",
    capabilities: { text: 3, code: 3 },
    modelType: "chat",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
    requiresDownload: true,
    maxContextTokens: 128_000,
  },
  {
    provider: "ollama",
    modelId: "qwen2.5:latest",
    displayName: "Ollama Qwen 2.5",
    capabilities: { text: 3, code: 2 },
    modelType: "chat",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
    requiresDownload: true,
    maxContextTokens: 128_000,
    tags: ["chinese-optimized"],
  },
  {
    provider: "ollama",
    modelId: "llava:latest",
    displayName: "Ollama LLaVA",
    capabilities: { text: 2, vision: 2 },
    modelType: "chat",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
    requiresDownload: true,
    maxContextTokens: 4_096,
  },
  {
    provider: "ollama",
    modelId: "nomic-embed-text:latest",
    displayName: "Ollama Nomic Embed",
    capabilities: { embedding: 2 },
    modelType: "specialized",
    region: "domestic",
    costTier: "free",
    costPer1M: 0.0,
    requiresDownload: true,
    embeddingDims: 768,
  },
];

// ---------------------------------------------------------------------------
// Cost tier ordering (for tie-breaking)
// ---------------------------------------------------------------------------

const COST_TIER_ORDER: Record<CostTier, number> = {
  premium: 0,
  standard: 1,
  free: 2,
};

// ---------------------------------------------------------------------------
// Registry state
// ---------------------------------------------------------------------------

/** Module-level card storage: built-in + remote + user overrides, merged. */
let mergedCards: ModelCapabilityCard[] = [...BUILTIN_CAPABILITY_CARDS];

/**
 * Remote cards fetched from obplugins.cn (Ed25519 signed).
 * Stored separately to allow re-merge when user overrides change.
 */
let remoteCards: ModelCapabilityCard[] = [];

/** User-configured overrides from config `dispatch.capabilityCards`. */
let userCards: ModelCapabilityCard[] = [];

/** Whether initCapabilityRegistry has been called. */
let registryInitialized = false;

/**
 * Provider credential check function — injected at init time.
 * Returns true if the user has configured API credentials for this provider.
 */
let isProviderConfigured: (provider: string) => boolean = () => false;

/**
 * Runtime probe results cache. Key: "provider/modelId/capability".
 * Persists across queries within same process lifetime.
 */
const probeCache = new Map<string, "verified" | "failed">();

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

export interface RegistryInitOptions {
  /** Function to check if a provider has API credentials configured. */
  isProviderConfigured: (provider: string) => boolean;
  /** User-configured capability card overrides. */
  userOverrides?: ModelCapabilityCard[];
}

/**
 * Initialize the capability registry.
 * Must be called once at startup (e.g., in gateway init).
 */
export function initCapabilityRegistry(options: RegistryInitOptions): void {
  if (registryInitialized) {
    log.warn(
      "capability-registry: initCapabilityRegistry() called more than once — " +
        "isProviderConfigured callback will be replaced. This may indicate a startup bug.",
    );
  }
  isProviderConfigured = options.isProviderConfigured;
  userCards = options.userOverrides ?? [];
  registryInitialized = true;
  rebuildMergedCards();
  log.debug(
    `capability-registry: initialized with ${mergedCards.length} cards ` +
      `(${BUILTIN_CAPABILITY_CARDS.length} built-in, ${remoteCards.length} remote, ${userCards.length} user)`,
  );
}

/**
 * Safely extract `dispatch.capabilityCards` from a config object.
 * Avoids unsafe `as Record<string, unknown>` double-cast at call sites.
 */
export function extractCapabilityCardOverrides(config: unknown): ModelCapabilityCard[] | undefined {
  if (config == null || typeof config !== "object") return undefined;
  const dispatch = (config as Record<string, unknown>).dispatch;
  if (dispatch == null || typeof dispatch !== "object") return undefined;
  const cards = (dispatch as Record<string, unknown>).capabilityCards;
  if (!Array.isArray(cards)) return undefined;
  return cards as ModelCapabilityCard[];
}

/**
 * Update user overrides (e.g., when config is reloaded).
 */
export function updateUserOverrides(overrides: ModelCapabilityCard[]): void {
  userCards = overrides;
  rebuildMergedCards();
}

/**
 * Insert or update a single user card in the registry.
 * Used by addCustomModel to make a newly-added model immediately visible
 * to capability_matrix.query / capability_matrix.summary without a full
 * registry reinitialisation.
 */
export function upsertUserCard(card: ModelCapabilityCard): void {
  const key = cardKey(card);
  const idx = userCards.findIndex((c) => cardKey(c) === key);
  if (idx >= 0) {
    userCards[idx] = card;
  } else {
    userCards.push(card);
  }
  rebuildMergedCards();
}

/**
 * Remove all user cards for a given provider.
 * Used by deleteProviderConfig to clean up stale cards from the registry.
 */
export function removeUserCardsByProvider(provider: string): void {
  const before = userCards.length;
  userCards = userCards.filter((c) => c.provider !== provider);
  if (userCards.length !== before) {
    rebuildMergedCards();
  }
}

/**
 * Refresh the isProviderConfigured callback (e.g., after setup wizard saves
 * a new API key and the auth profile store has changed on disk).
 */
export function refreshProviderConfigured(check: (provider: string) => boolean): void {
  isProviderConfigured = check;
}

/**
 * Merge remote-updated cards (e.g., from obplugins.cn fetch).
 * Remote cards override built-in; user cards override both.
 */
export function applyRemoteCards(cards: ModelCapabilityCard[]): void {
  remoteCards = cards;
  rebuildMergedCards();
  log.debug(
    `capability-registry: applied ${cards.length} remote cards, total=${mergedCards.length}`,
  );
}

function rebuildMergedCards(): void {
  // Priority: user > remote > built-in
  const index = new Map<string, ModelCapabilityCard>();

  for (const card of BUILTIN_CAPABILITY_CARDS) {
    index.set(cardKey(card), card);
  }
  for (const card of remoteCards) {
    index.set(cardKey(card), card);
  }
  for (const card of userCards) {
    index.set(cardKey(card), card);
  }

  mergedCards = [...index.values()];
}

function cardKey(card: ModelCapabilityCard): string {
  return `${card.provider}/${card.modelId}`;
}

// ---------------------------------------------------------------------------
// Strength Tier
// ---------------------------------------------------------------------------

/** Derive strength tier from capability scores. Used when card has no explicit tier. */
export function deriveStrengthTier(card: ModelCapabilityCard): ModelStrengthTier {
  const text = card.capabilities.text ?? 0;
  const code = card.capabilities.code ?? 0;
  if (text >= 4 || code >= 4) return "strong";
  if (text >= 3 || code >= 3) return "moderate";
  return "weak";
}

/** Get effective strength tier: explicit card.strengthTier first, otherwise derive from scores. */
export function getCardStrengthTier(card: ModelCapabilityCard): ModelStrengthTier {
  return card.strengthTier ?? deriveStrengthTier(card);
}

// ---------------------------------------------------------------------------
// Query API
// ---------------------------------------------------------------------------

/**
 * Query the registry for models that support a specific capability.
 *
 * Returns enriched cards sorted by the active routing policy.
 */
export function queryByCapability(
  capability: CapabilityKey,
  filter?: RegistryQueryFilter,
  policy?: RoutingPolicy,
): EnrichedCard[] {
  const effectivePolicy = policy ?? "best-quality";
  const healthyOnly = filter?.healthyOnly ?? true;

  const results: EnrichedCard[] = [];

  for (const card of mergedCards) {
    const score = card.capabilities[capability];
    if (score == null || score <= 0) continue;

    // Apply filters — local models are always considered configured
    if (filter?.configuredOnly) {
      if (card.provider !== "local" && !isProviderConfigured(card.provider)) continue;
    }
    if (filter?.domesticOnly && card.region !== "domestic") continue;
    if (filter?.tags) {
      const cardTags = card.tags ?? [];
      if (!filter.tags.every((t) => cardTags.includes(t))) continue;
    }

    // Build runtime state
    const health = checkProviderHealth(card.provider);
    if (healthyOnly && health === "down") continue;

    const probeResults: ModelRuntimeState["probeResults"] = {};
    const probeKey = `${card.provider}/${card.modelId}/${capability}`;
    const probeResult = probeCache.get(probeKey);
    if (probeResult) {
      probeResults[capability] = probeResult;
    } else {
      probeResults[capability] = "untested";
    }

    if (filter?.verifiedOnly && probeResults[capability] !== "verified") continue;

    const enriched: EnrichedCard = {
      ...card,
      runtime: {
        configured: card.provider === "local" || isProviderConfigured(card.provider),
        health,
        probeResults,
      },
    };
    results.push(enriched);
  }

  // Sort by health status first (degraded providers pushed down), then by routing policy.
  // Combined into a single sort to avoid relying on sort stability across JS engines.
  results.sort((a, b) => {
    // Penalize degraded providers (push them down, don't remove)
    const healthA = a.runtime.health === "degraded" ? 1 : 0;
    const healthB = b.runtime.health === "degraded" ? 1 : 0;
    if (healthA !== healthB) return healthA - healthB;

    const scoreA = a.capabilities[capability] ?? 0;
    const scoreB = b.capabilities[capability] ?? 0;

    // CN: prefer domestic models over international when scores are equal.
    // This prevents international premium models (e.g. Claude) from outranking
    // configured domestic models (e.g. Kimi Code) in tie-break scenarios.
    const regionA = a.region === "domestic" ? 0 : 1;
    const regionB = b.region === "domestic" ? 0 : 1;

    switch (effectivePolicy) {
      case "best-quality":
        // Pure quality: highest score wins. Tie-break: domestic > international, then premium > standard > free
        if (scoreB !== scoreA) return scoreB - scoreA;
        if (regionA !== regionB) return regionA - regionB;
        return COST_TIER_ORDER[a.costTier] - COST_TIER_ORDER[b.costTier];

      case "cost-balanced": {
        // Weighted: 70% quality + 30% cost efficiency, with domestic preference for ties
        const weightedA = scoreA * 0.7 + (5 - Math.min(5, a.costPer1M / 20)) * 0.3;
        const weightedB = scoreB * 0.7 + (5 - Math.min(5, b.costPer1M / 20)) * 0.3;
        if (weightedB !== weightedA) return weightedB - weightedA;
        return regionA - regionB;
      }

      case "budget":
        // Cheapest first, but must meet minimum quality (score >= 2)
        if (scoreA < 2 && scoreB >= 2) return 1;
        if (scoreB < 2 && scoreA >= 2) return -1;
        return a.costPer1M - b.costPer1M || regionA - regionB || scoreB - scoreA;

      default:
        if (scoreB !== scoreA) return scoreB - scoreA;
        return regionA - regionB;
    }
  });

  return results;
}

/**
 * Get all capabilities for a specific provider.
 */
export function getProviderCapabilities(provider: string): ModelCapabilityCard[] {
  return mergedCards.filter((c) => c.provider === provider);
}

/**
 * Find a specific card by provider + modelId (or alias).
 */
export function findCard(provider: string, modelId: string): ModelCapabilityCard | undefined {
  return mergedCards.find(
    (c) => c.provider === provider && (c.modelId === modelId || c.aliases?.includes(modelId)),
  );
}

/**
 * Get the user's complete capability matrix summary.
 * Shows what's available, what's missing, and what could be enabled.
 */
export function getCapabilityMatrixSummary(): CapabilityMatrixSummary {
  const allCapabilities: CapabilityKey[] = [
    "text",
    "code",
    "vision",
    "imageGen",
    "imageEdit",
    "video",
    "videoGen",
    "audio",
    "tts",
    "embedding",
    "toolCall",
  ];

  const available: CapabilityMatrixSummary["available"] = [];
  const missing: CapabilityKey[] = [];
  const unconfigured: CapabilityMatrixSummary["unconfigured"] = [];

  for (const cap of allCapabilities) {
    // Check configured models first.
    // healthyOnly: false — summary shows *configuration* status, not real-time health.
    // A temporarily degraded/down provider should still show as "active" (configured).
    const configuredResults = queryByCapability(cap, { configuredOnly: true, healthyOnly: false });
    // [CN-PATCH] 过滤掉本地模型（provider=local），本版本暂不支持本地模型
    const cloudConfigured = configuredResults.filter((c) => c.provider !== "local");
    if (cloudConfigured.length > 0) {
      available.push({
        capability: cap,
        bestCard: cloudConfigured[0]!,
        alternatives: cloudConfigured.length - 1,
      });
      continue;
    }

    // Check if there are unconfigured models that could provide this
    const allResults = queryByCapability(cap, { healthyOnly: false });
    // [CN-PATCH] 过滤掉本地模型（provider=local）
    const cloudAll = allResults.filter((c) => c.provider !== "local");
    if (cloudAll.length > 0) {
      unconfigured.push({
        capability: cap,
        recommendation: cloudAll[0]!,
      });
    } else {
      missing.push(cap);
    }
  }

  return { available, missing, unconfigured };
}

// ---------------------------------------------------------------------------
// Runtime probe API
// ---------------------------------------------------------------------------

/**
 * Record the result of a runtime capability probe.
 * Called after the first successful/failed use of a model for a specific capability.
 */
export function recordProbeResult(
  provider: string,
  modelId: string,
  capability: CapabilityKey,
  result: "verified" | "failed",
): void {
  const key = `${provider}/${modelId}/${capability}`;
  probeCache.set(key, result);
  log.debug(`capability-registry: probe ${key} → ${result}`);
}

/**
 * Check if a model+capability combo has been probed.
 */
export function getProbeResult(
  provider: string,
  modelId: string,
  capability: CapabilityKey,
): "verified" | "failed" | "untested" {
  return probeCache.get(`${provider}/${modelId}/${capability}`) ?? "untested";
}

// ---------------------------------------------------------------------------
// Backward compatibility: generate ModelProfile[] for modality-router
// ---------------------------------------------------------------------------

// Re-export the old type for backward compatibility
import type { ModelProfile, ModelCapability } from "./modality-router.js";

/**
 * Generate ModelProfile[] from the registry, compatible with the existing
 * modality-router scoring system.
 *
 * This is the bridge function that allows gradual migration:
 * modality-router.ts calls this instead of using BUILTIN_PROFILES directly.
 */
export function toModelProfiles(filter?: RegistryQueryFilter): ModelProfile[] {
  const cards = filter
    ? mergedCards.filter((card) => {
        if (
          filter.configuredOnly &&
          card.provider !== "local" &&
          !isProviderConfigured(card.provider)
        )
          return false;
        if (filter.domesticOnly && card.region !== "domestic") return false;
        return true;
      })
    : mergedCards;

  return cards
    .filter((card) => card.modelType === "chat") // Only chat models participate in modality routing
    .map((card) => ({
      provider: card.provider,
      model: card.modelId,
      capabilities: {
        text: card.capabilities.text,
        vision: card.capabilities.vision,
        audio: card.capabilities.audio,
        video: card.capabilities.video,
        videoGen: card.capabilities.videoGen,
        code: card.capabilities.code,
        imageGen: card.capabilities.imageGen,
        imageEdit: card.capabilities.imageEdit,
      } satisfies ModelCapability,
      costPer1M: card.costPer1M,
      region: card.region,
    }));
}

// ---------------------------------------------------------------------------
// Backward compatibility: generate auto-provider lists for media-understanding
// ---------------------------------------------------------------------------

/**
 * Get the ordered list of providers for a media capability.
 * Replaces AUTO_IMAGE_KEY_PROVIDERS, AUTO_AUDIO_KEY_PROVIDERS, AUTO_VIDEO_KEY_PROVIDERS.
 */
export function getAutoProviders(
  capability: "vision" | "audio" | "video",
  options?: { configuredOnly?: boolean },
): string[] {
  const results = queryByCapability(
    capability,
    { configuredOnly: options?.configuredOnly, healthyOnly: true },
    "best-quality",
  );

  // Deduplicate by provider (take the best model per provider)
  const seen = new Set<string>();
  const providers: string[] = [];
  for (const card of results) {
    if (!seen.has(card.provider)) {
      seen.add(card.provider);
      providers.push(card.provider);
    }
  }
  return providers;
}

/**
 * Get the best model ID for a provider + capability combo.
 * Replaces DEFAULT_IMAGE_MODELS, DEFAULT_AUDIO_MODELS.
 */
export function getBestModelForProvider(
  provider: string,
  capability: CapabilityKey,
): string | undefined {
  const cards = mergedCards
    .filter((c) => c.provider === provider && (c.capabilities[capability] ?? 0) > 0)
    .sort((a, b) => (b.capabilities[capability] ?? 0) - (a.capabilities[capability] ?? 0));
  return cards[0]?.modelId;
}

// ---------------------------------------------------------------------------
// All cards access (for UI and diagnostics)
// ---------------------------------------------------------------------------

/**
 * Get all merged cards (for diagnostics, UI capability matrix display).
 */
export function getAllCards(): readonly ModelCapabilityCard[] {
  return mergedCards;
}

/**
 * Get all capability keys.
 */
export function getAllCapabilityKeys(): readonly CapabilityKey[] {
  return [
    "text",
    "code",
    "vision",
    "imageGen",
    "imageEdit",
    "video",
    "videoGen",
    "audio",
    "tts",
    "embedding",
    "toolCall",
  ];
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

export function resetRegistryForTests(): void {
  mergedCards = [...BUILTIN_CAPABILITY_CARDS];
  remoteCards = [];
  userCards = [];
  probeCache.clear();
  isProviderConfigured = () => false;
  registryInitialized = false;
}
