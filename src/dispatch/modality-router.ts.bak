/**
 * Modality Router — auto-selects the optimal model based on detected input modality.
 *
 * This module extends the dispatch engine's routing decision by detecting what
 * the user actually sent (text, image, audio, video, code, image-generation request)
 * and selecting a model that best handles that modality.
 *
 * Design principles:
 *   - Zero user configuration needed for basic usage (automatic mode)
 *   - Integrates with existing tier-selector for cost-aware selection
 *   - Respects provider-health status to skip known-down providers
 *   - CN-only module: lives in src/dispatch/ (safe from upstream rebase)
 *   - Does NOT modify upstream files — consumed by get-reply.ts injection point
 *
 * Architecture:
 *   1. Intent Detector  → classifies what the user wants (understand vs generate)
 *   2. Capability Matrix → knows which models support which modalities
 *   3. Candidate Filter  → filters by health + API key availability
 *   4. Scorer            → ranks by quality × cost × region preference
 *   5. Decision          → returns best model + fallback chain
 */

import type { OpenClawCNConfig } from "../config/config.js";
import type { MediaAttachment } from "../media-understanding/types.js";
import { resolveAttachmentKind } from "../media-understanding/attachments.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { checkProviderHealth } from "./provider-health.js";

const log = createSubsystemLogger("dispatch/modality-router");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Detected modality of the user's request. */
export type ModalityIntent =
  | "text"              // Pure text conversation
  | "code"              // Code generation / debugging
  | "image_understand"  // User sent an image, wants it analyzed
  | "image_generate"    // User wants an image created
  | "audio_understand"  // User sent audio/voice
  | "video_understand"  // User sent a video
  | "video_generate"    // User wants a video created (future)
  | "document_understand"; // User sent PDF/doc

/** A model's capability declaration. */
export type ModelCapability = {
  text?: number;    // 1-5 quality score
  vision?: number;
  audio?: number;
  video?: number;
  code?: number;
  imageGen?: number;
};

/** A model profile in the capability matrix. */
export type ModelProfile = {
  provider: string;
  model: string;
  capabilities: ModelCapability;
  /** Total cost per 1M tokens (input + output, USD). */
  costPer1M: number;
  region: "domestic" | "international";
};

/** Result of modality-based routing. */
export type ModalityRoutingResult = {
  provider: string;
  model: string;
  /** Why this model was selected. */
  reason: string;
  /** Whether the model was switched from the current default. */
  switched: boolean;
  /** Fallback models in priority order. */
  fallbacks: Array<{ provider: string; model: string }>;
  /** Detected modality intent. */
  modalityIntent: ModalityIntent;
};

/** Options for the modality router. */
export type ModalityRouterOptions = {
  /** User message text. */
  body: string;
  /** Media attachments from the message. */
  attachments: MediaAttachment[];
  /** Full config object. */
  cfg: OpenClawCNConfig;
  /** Agent directory for model resolution. */
  agentDir?: string;
  /** Currently selected model (before routing). */
  currentModel: { provider: string; model: string };
};

// ---------------------------------------------------------------------------
// Intent Detection — classifies WHAT the user wants
// ---------------------------------------------------------------------------

// Chinese patterns for image generation requests
const IMAGE_GEN_PATTERNS: RegExp[] = [
  /画[一个两三张幅]/, /生成.{0,6}(?:图|图片|图像|照片|壁纸|头像|海报|logo)/,
  /做[一个张].{0,4}(?:图|海报|封面)/, /帮我画/, /设计[一个张幅]/,
  /创作.{0,4}(?:图片|插画|漫画)/, /P[一个张].*图/,
  /(?:制作|创建).{0,4}(?:图片|图像|头像|表情包)/,
];

// English patterns for image generation requests
const IMAGE_GEN_PATTERNS_EN: RegExp[] = [
  /\b(?:generate|create|make|draw|paint|design)\b.{0,20}\b(?:image|picture|photo|illustration|icon|logo|poster)\b/i,
  /\b(?:image|picture|photo)\b.{0,10}\b(?:of|with|showing)\b/i,
];

// Chinese patterns for video generation requests
const VIDEO_GEN_PATTERNS: RegExp[] = [
  /生成.{0,6}(?:视频|动画|短片)/, /制作.{0,4}(?:视频|动画)/,
  /做[一个].{0,4}(?:视频|动画)/,
];

// Code task strong indicators (single match is sufficient)
const CODE_STRONG_INDICATORS: RegExp[] = [
  /```[\s\S]{6,}```/, // Code blocks with actual content (not just empty fences)
  /(?:写|编写|实现|修复|调试|重构).{0,6}(?:代码|函数|方法|接口|组件|模块|脚本|程序)/,
  /\b(?:implement|refactor|debug)\b.{0,20}\b(?:code|function|method|class|module|component)\b/i,
  /(?:stack\s*trace|traceback|segfault|core\s*dump)/i,
];

// Code task weak indicators (need 2+ to trigger)
const CODE_WEAK_INDICATORS: RegExp[] = [
  /\b(?:function|const|let|var|def|async|await|return|import|export)\b/,
  /\b(?:bug|error|exception|报错|错误|异常)\b/i,
  /[{};()]\s*$/m, // Lines ending with code syntax
  /\b(?:npm|pip|yarn|pnpm|cargo|git)\b/i,
];

/**
 * Detect the modality intent from message content and attachments.
 * Priority: attachments > text patterns > default.
 */
export function detectModalityIntent(
  body: string,
  attachments: MediaAttachment[],
): ModalityIntent {
  // 1. Check attachments first — they are unambiguous signals
  const kinds = attachments.map((a) => resolveAttachmentKind(a));
  const hasVideo = kinds.includes("video");
  const hasAudio = kinds.includes("audio");
  const hasImage = kinds.includes("image");
  const hasDocument = kinds.includes("document");

  if (hasVideo) return "video_understand";
  if (hasAudio) return "audio_understand";
  if (hasImage) return "image_understand";
  if (hasDocument) return "document_understand";

  // 2. No attachments — analyze text for generation intents
  const text = body.trim();
  if (!text) return "text";

  // Image generation
  if (
    IMAGE_GEN_PATTERNS.some((p) => p.test(text)) ||
    IMAGE_GEN_PATTERNS_EN.some((p) => p.test(text))
  ) {
    return "image_generate";
  }

  // Video generation
  if (VIDEO_GEN_PATTERNS.some((p) => p.test(text))) {
    return "video_generate";
  }

  // Code tasks: strong indicator alone, or 2+ weak indicators together
  if (CODE_STRONG_INDICATORS.some((p) => p.test(text))) {
    return "code";
  }
  const weakCodeHits = CODE_WEAK_INDICATORS.filter((p) => p.test(text)).length;
  if (weakCodeHits >= 2) {
    return "code";
  }

  // 3. Default: text
  return "text";
}

// ---------------------------------------------------------------------------
// Capability Matrix — built-in model profiles
// ---------------------------------------------------------------------------

/**
 * Built-in capability matrix. Updated manually when new models are added.
 * Users can override via config `dispatch.modelProfiles`.
 *
 * Quality scores: 1=basic, 2=fair, 3=good, 4=excellent, 5=best-in-class
 * Cost: total (input + output) per 1M tokens in USD
 */
const BUILTIN_PROFILES: ModelProfile[] = [
  // ── Domestic (国内模型, low latency, compliant) ──
  {
    provider: "deepseek",
    model: "deepseek-chat",
    capabilities: { text: 4, code: 5 },
    costPer1M: 1.37,
    region: "domestic",
  },
  {
    provider: "deepseek",
    model: "deepseek-reasoner",
    capabilities: { text: 5, code: 5 },
    costPer1M: 6.27,
    region: "domestic",
  },
  {
    provider: "qwen",
    model: "qwen-vl-max",
    capabilities: { text: 4, vision: 4, code: 3 },
    costPer1M: 12.0,
    region: "domestic",
  },
  {
    provider: "qwen",
    model: "qwen-max",
    capabilities: { text: 4, code: 4 },
    costPer1M: 5.6,
    region: "domestic",
  },
  {
    provider: "qwen",
    model: "qwen-turbo",
    capabilities: { text: 3, code: 3 },
    costPer1M: 0.4,
    region: "domestic",
  },
  {
    provider: "zhipu",
    model: "glm-4v-plus",
    capabilities: { text: 3, vision: 3 },
    costPer1M: 8.0,
    region: "domestic",
  },
  {
    provider: "zhipu",
    model: "glm-4-plus",
    capabilities: { text: 3, code: 3 },
    costPer1M: 2.0,
    region: "domestic",
  },
  {
    provider: "zhipu",
    model: "glm-4-flash",
    capabilities: { text: 2, code: 2 },
    costPer1M: 0.0,
    region: "domestic",
  },
  {
    provider: "doubao",
    model: "doubao-1.5-pro-256k",
    capabilities: { text: 4, code: 3 },
    costPer1M: 2.8,
    region: "domestic",
  },
  {
    provider: "moonshot",
    model: "moonshot-v1-auto",
    capabilities: { text: 3, code: 3 },
    costPer1M: 4.0,
    region: "domestic",
  },
  {
    provider: "siliconflow",
    model: "deepseek-ai/DeepSeek-V3",
    capabilities: { text: 4, code: 5 },
    costPer1M: 2.0,
    region: "domestic",
  },

  // ── International (国际模型, higher quality, may need proxy) ──
  {
    provider: "anthropic",
    model: "claude-opus-4-6",
    capabilities: { text: 5, vision: 4, code: 5 },
    costPer1M: 90.0,
    region: "international",
  },
  {
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    capabilities: { text: 5, vision: 4, code: 5 },
    costPer1M: 18.0,
    region: "international",
  },
  {
    provider: "openai",
    model: "gpt-4o",
    capabilities: { text: 4, vision: 5, audio: 4, video: 3, code: 4, imageGen: 3 },
    costPer1M: 12.5,
    region: "international",
  },
  {
    provider: "openai",
    model: "gpt-4o-mini",
    capabilities: { text: 3, vision: 3, code: 3 },
    costPer1M: 0.75,
    region: "international",
  },
  {
    provider: "google",
    model: "gemini-2.0-flash",
    capabilities: { text: 4, vision: 4, audio: 3, video: 4, code: 3 },
    costPer1M: 1.5,
    region: "international",
  },
];

// ---------------------------------------------------------------------------
// Capability Matrix Manager
// ---------------------------------------------------------------------------

/**
 * Merge built-in profiles with user-configured overrides from config.
 * User profiles take precedence (matched by provider+model key).
 */
export function getCapabilityMatrix(cfg: OpenClawCNConfig): ModelProfile[] {
  const userProfiles = (cfg as Record<string, unknown>).dispatch as
    | { modelProfiles?: ModelProfile[] }
    | undefined;
  const overrides = userProfiles?.modelProfiles;
  if (!overrides || overrides.length === 0) {
    return BUILTIN_PROFILES;
  }

  // Build override index
  const overrideIndex = new Map<string, ModelProfile>();
  for (const profile of overrides) {
    overrideIndex.set(`${profile.provider}/${profile.model}`, profile);
  }

  // Merge: override wins, then append new user profiles
  const merged: ModelProfile[] = [];
  const seen = new Set<string>();

  for (const builtin of BUILTIN_PROFILES) {
    const key = `${builtin.provider}/${builtin.model}`;
    const override = overrideIndex.get(key);
    merged.push(override ?? builtin);
    seen.add(key);
  }

  // Append user-only profiles not in builtin
  for (const [key, profile] of overrideIndex) {
    if (!seen.has(key)) {
      merged.push(profile);
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Required capability per modality intent
// ---------------------------------------------------------------------------

const REQUIRED_CAPABILITY: Record<ModalityIntent, keyof ModelCapability> = {
  text: "text",
  code: "code",
  image_understand: "vision",
  image_generate: "imageGen",
  audio_understand: "audio",
  video_understand: "video",
  video_generate: "video",
  document_understand: "text",
};

// ---------------------------------------------------------------------------
// Scoring — ranks candidates by quality × cost × region
// ---------------------------------------------------------------------------

function scoreCandidate(
  profile: ModelProfile,
  requiredCapability: keyof ModelCapability,
  preferDomestic: boolean,
  budgetMode: boolean,
): number {
  const capScore = profile.capabilities[requiredCapability] ?? 0;
  if (capScore === 0) return -1; // Cannot handle this modality

  // Base score from capability quality (0-5 → 0-100)
  let score = capScore * 20;

  // Region bonus: +30 for domestic if preferred
  if (preferDomestic && profile.region === "domestic") {
    score += 30;
  }

  // Cost factor: lower cost = higher score in budget mode
  if (budgetMode) {
    // Invert cost: $0 → +50, $90 → +0
    const costPenalty = Math.min(50, profile.costPer1M * 0.55);
    score += 50 - costPenalty;
  } else {
    // Normal mode: slight cost awareness (don't overspend on simple tasks)
    const costPenalty = Math.min(20, profile.costPer1M * 0.22);
    score += 20 - costPenalty;
  }

  return score;
}

// ---------------------------------------------------------------------------
// Main Router
// ---------------------------------------------------------------------------

/**
 * Route a user message to the optimal model based on detected modality.
 *
 * Returns null if the current model is already optimal (no switch needed).
 *
 * Flow:
 *   1. Detect modality intent from message + attachments
 *   2. If modality is plain text and current model handles text → no switch
 *   3. Filter capability matrix for models that support required modality
 *   4. Check provider health (skip known-down providers)
 *   5. Score candidates by quality × cost × region
 *   6. Return best candidate with fallbacks
 */
export async function routeByModality(
  options: ModalityRouterOptions,
): Promise<ModalityRoutingResult | null> {
  const { body, attachments, cfg, currentModel } = options;

  // 1. Detect modality
  const intent = detectModalityIntent(body, attachments);

  // 2. For plain text or document-only input, current model is fine
  if (intent === "text" || intent === "document_understand") {
    return null; // Current model handles text, no switch needed
  }

  const requiredCap = REQUIRED_CAPABILITY[intent];
  if (!requiredCap) {
    return null;
  }

  // 3. Check if current model already supports this modality
  const matrix = getCapabilityMatrix(cfg);
  const currentProfile = matrix.find(
    (p) => p.provider === currentModel.provider && p.model === currentModel.model,
  );
  if (currentProfile) {
    const currentCapScore = currentProfile.capabilities[requiredCap] ?? 0;
    if (currentCapScore >= 3) {
      // Current model is good enough (score 3+), don't switch
      log.debug(
        `modality-router: current model ${currentModel.provider}/${currentModel.model} ` +
          `supports ${requiredCap} (score=${currentCapScore}), no switch needed`,
      );
      return null;
    }
  }

  // 4. Find candidates that support the required capability
  const preferDomestic = cfg.agents?.defaults?.preferDomestic === true;
  const budgetMode =
    (cfg.meta?.performanceProfile ?? "balanced") === "economy";

  const candidates: Array<{ profile: ModelProfile; score: number }> = [];
  for (const profile of matrix) {
    const score = scoreCandidate(profile, requiredCap, preferDomestic, budgetMode);
    if (score <= 0) continue;

    // Check provider health
    const health = checkProviderHealth(profile.provider);
    if (health === "down") {
      log.debug(`modality-router: skipping ${profile.provider} (health=down)`);
      continue;
    }
    if (health === "degraded") {
      // Penalize degraded providers
      candidates.push({ profile, score: score * 0.6 });
    } else {
      candidates.push({ profile, score });
    }
  }

  if (candidates.length === 0) {
    log.debug(`modality-router: no candidates for ${requiredCap}, keeping current model`);
    return null;
  }

  // 5. Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  const best = candidates[0]!.profile;
  const fallbacks = candidates
    .slice(1, 4)
    .map((c) => ({ provider: c.profile.provider, model: c.profile.model }));

  // 6. Check if we'd switch to a different model
  if (best.provider === currentModel.provider && best.model === currentModel.model) {
    return null;
  }

  const reason =
    `modality=${intent} required=${requiredCap} ` +
    `selected=${best.provider}/${best.model} ` +
    `score=${candidates[0]!.score.toFixed(1)} ` +
    `region=${best.region} cost=$${best.costPer1M.toFixed(2)}/1M`;

  log.debug(`modality-router: ${reason}`);

  return {
    provider: best.provider,
    model: best.model,
    reason,
    switched: true,
    fallbacks,
    modalityIntent: intent,
  };
}

// ---------------------------------------------------------------------------
// Code intent detection helper (also used by intent-classifier)
// ---------------------------------------------------------------------------

/**
 * Check if a message looks like a code-related task.
 * Exported for use by other dispatch modules.
 */
export function looksLikeCodeTask(text: string): boolean {
  if (CODE_STRONG_INDICATORS.some((p) => p.test(text))) return true;
  return CODE_WEAK_INDICATORS.filter((p) => p.test(text)).length >= 2;
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

export function getBuiltinProfilesForTests(): ModelProfile[] {
  return [...BUILTIN_PROFILES];
}
