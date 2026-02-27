/**
 * ImageGen Tier Decision Engine -- maps hardware to optimal local image model.
 *
 * Pure functions, no I/O, no side effects. Easy to unit test.
 * Pattern follows voice/voice-tier.ts.
 *
 * Decision rules:
 *   available_vram = gpu_total_vram * 70%
 *   available_ram  = free_ram * 70%
 *
 *   NVIDIA GPU && available_vram >= 4.0 GB  -> gpu-hq   (SDXL base, ~10s/image)
 *   NVIDIA GPU && available_vram >= 2.0 GB  -> gpu-fast  (SD-Turbo, ~3s/image)
 *   available_ram >= 2.0 GB                 -> cpu       (SD-Turbo CPU, ~60s/image)
 *   otherwise                               -> api-only  (cloud API only)
 */

import type { ImageGenModelSpec, ImageGenTierDecision, ImageGenTierLevel } from "./types.js";
import type { HardwareSnapshot } from "../voice/types.js";
import { ALL_MODELS, GPU_MODELS, CPU_MODELS } from "./imagegen-models.js";

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** Budget ratio -- only use 70% of available resources. */
const BUDGET_RATIO = 0.7;

// GPU VRAM thresholds (after budget applied to total VRAM)
const GPU_HQ_VRAM_MB = 4000; // SDXL base (~3.5GB) + overhead
const GPU_FAST_VRAM_MB = 2000; // SD-Turbo (~1.5GB) + overhead

// CPU RAM thresholds (after budget applied to free RAM)
const CPU_MIN_RAM_MB = 2000; // SD-Turbo CPU mode needs ~2GB

// ---------------------------------------------------------------------------
// Decision Logic
// ---------------------------------------------------------------------------

/**
 * Classify hardware into an image generation tier.
 */
export function classifyImageGenTier(hw: HardwareSnapshot): ImageGenTierDecision {
  // Try GPU path first (NVIDIA only -- sd.cpp CUDA backend)
  if (hw.gpu?.vendor === "nvidia") {
    // Use the lesser of budgeted total and actual free VRAM (M17 fix)
    const budgetedVram = hw.gpu.vramTotalMB * BUDGET_RATIO;
    const freeVram = hw.gpu.vramFreeMB ?? hw.gpu.vramTotalMB;
    const availableVram = Math.min(budgetedVram, freeVram);

    if (availableVram >= GPU_HQ_VRAM_MB) {
      return {
        tier: "gpu-hq",
        model: GPU_MODELS.sdxlBase,
        reason: `${hw.gpu.name} (${hw.gpu.vramTotalMB} MB VRAM) -- 可运行 SDXL 高质量生图`,
        hardware: hw,
      };
    }

    if (availableVram >= GPU_FAST_VRAM_MB) {
      return {
        tier: "gpu-fast",
        model: GPU_MODELS.sdTurbo,
        reason: `${hw.gpu.name} (${hw.gpu.vramTotalMB} MB VRAM) -- 显存有限，使用 SD-Turbo 快速生图`,
        hardware: hw,
      };
    }

    // NVIDIA GPU exists but VRAM too low -- fall through to CPU
  }

  // CPU path
  const availableRam = hw.freeRamMB * BUDGET_RATIO;

  if (availableRam >= CPU_MIN_RAM_MB) {
    return {
      tier: "cpu",
      model: CPU_MODELS.sdTurboCpu,
      reason: `CPU 模式 (可用内存 ${Math.round(availableRam)} MB) -- 可运行 SD-Turbo 生图 (较慢)`,
      hardware: hw,
    };
  }

  return {
    tier: "api-only",
    model: null,
    reason: `硬件不满足本地生图要求 (需要 2GB+ 可用内存或 NVIDIA GPU)，仅支持云端 API 生图`,
    hardware: hw,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get model spec for a given tier level.
 */
export function getModelForTier(tier: ImageGenTierLevel): ImageGenModelSpec | null {
  switch (tier) {
    case "gpu-hq":
      return GPU_MODELS.sdxlBase;
    case "gpu-fast":
      return GPU_MODELS.sdTurbo;
    case "cpu":
      return CPU_MODELS.sdTurboCpu;
    case "api-only":
    case "disabled":
      return null;
  }
}

/** UI badge for tier display. */
export type ImageGenTierBadge = "gold" | "silver" | "bronze" | "disabled";

/**
 * User-facing tier description for the settings UI.
 */
export function describeImageGenTier(decision: ImageGenTierDecision): {
  title: string;
  description: string;
  badge: ImageGenTierBadge;
} {
  switch (decision.tier) {
    case "gpu-hq":
      return {
        title: "GPU 高质量模式",
        description: `SDXL 模型 -- 高质量生图，约 10 秒/张 (${decision.hardware.gpu?.name ?? "NVIDIA GPU"})`,
        badge: "gold",
      };
    case "gpu-fast":
      return {
        title: "GPU 快速模式",
        description: `SD-Turbo -- 极速生图，约 3 秒/张 (${decision.hardware.gpu?.name ?? "NVIDIA GPU"})`,
        badge: "silver",
      };
    case "cpu":
      return {
        title: "CPU 模式",
        description: "SD-Turbo CPU 推理 -- 约 60 秒/张，适合轻量使用",
        badge: "bronze",
      };
    case "api-only":
      return {
        title: "仅云端 API",
        description: "硬件不支持本地生图，可使用 DashScope/SiliconFlow 等云端 API",
        badge: "disabled",
      };
    case "disabled":
      return {
        title: "生图功能未配置",
        description: decision.reason,
        badge: "disabled",
      };
  }
}

/**
 * Whether a tier uses the local sd.cpp sidecar.
 */
export function tierUsesSidecar(tier: ImageGenTierLevel): boolean {
  return tier === "gpu-hq" || tier === "gpu-fast" || tier === "cpu";
}

/**
 * Total download size for a tier's model (in MB).
 */
export function tierDownloadSizeMB(tier: ImageGenTierLevel): number {
  const model = getModelForTier(tier);
  return model?.downloadSizeMB ?? 0;
}

/**
 * List all available models (for advanced users to select).
 */
export function getAllModels(): Record<string, ImageGenModelSpec> {
  return ALL_MODELS;
}
