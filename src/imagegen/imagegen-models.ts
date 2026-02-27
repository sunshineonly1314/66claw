/**
 * Image Generation Model Catalog -- static definitions of available models.
 *
 * Download sources with CN-first priority:
 *   1. ModelScope API -- fastest (~25 MB/s)
 *   2. ModelScope resolve -- same CDN, HuggingFace-compatible URL
 *   3. hf-mirror.com -- slow (~0.2 MB/s) but reliable fallback
 *
 * Pattern follows voice/voice-models.ts.
 */

import type { ImageGenModelSpec } from "./types.js";

// ---------------------------------------------------------------------------
// URL Helpers
// ---------------------------------------------------------------------------

/** ModelScope official API. */
function ms(modelId: string, filePath: string): string {
  return `https://modelscope.cn/api/v1/models/${modelId}/repo?Revision=master&FilePath=${encodeURIComponent(filePath)}`;
}

/** ModelScope resolve path. */
function ms2(modelId: string, filePath: string): string {
  return `https://modelscope.cn/models/${modelId}/resolve/master/${filePath}`;
}

/** hf-mirror.com -- fallback. */
function hf(repoId: string, filePath: string): string {
  return `https://hf-mirror.com/${repoId}/resolve/main/${filePath}`;
}

/** Build sources array -- 3 mirrors, ModelScope priority. */
function sources(msModel: string, hfRepo: string, file: string) {
  return [
    { label: "魔搭", url: ms(msModel, file) },
    { label: "魔搭备用", url: ms2(msModel, file) },
    { label: "hf-mirror", url: hf(hfRepo, file) },
  ];
}

// ---------------------------------------------------------------------------
// GPU Models (sd.cpp with CUDA acceleration)
// ---------------------------------------------------------------------------

const SDXL_MS = "AI-ModelScope/stable-diffusion-xl-base-1.0";
const SDXL_HF = "stabilityai/stable-diffusion-xl-base-1.0";

/**
 * SDXL Base 1.0 -- high quality, 1024x1024 native resolution.
 * ~3.5 GB VRAM (fp16). Model weights: ~6.5 GB (fp16 safetensors).
 */
const SDXL_BASE_1_0: ImageGenModelSpec = {
  id: "sdxl-base-1.0",
  displayName: "Stable Diffusion XL Base 1.0 (GPU)",
  backend: "sd-cpp",
  sdType: "sdxl",
  estimatedMemoryMB: 3500,
  downloadSizeMB: 6500,
  modelDirName: "sdxl-base-1.0",
  defaultSize: "1024x1024",
  files: [
    {
      relativePath: "sd_xl_base_1.0.safetensors",
      sizeBytes: 6_938_078_178,
      sources: sources(SDXL_MS, SDXL_HF, "sd_xl_base_1.0.safetensors"),
    },
  ],
};

const SD_TURBO_MS = "AI-ModelScope/sd-turbo";
const SD_TURBO_HF = "stabilityai/sd-turbo";

/**
 * SD-Turbo -- distilled for 1-step generation, extremely fast.
 * ~1.5 GB VRAM (fp16). Model weights: ~3.3 GB.
 */
const SD_TURBO: ImageGenModelSpec = {
  id: "sd-turbo",
  displayName: "SD-Turbo (GPU, 极速)",
  backend: "sd-cpp",
  sdType: "sd1",
  estimatedMemoryMB: 1500,
  downloadSizeMB: 3300,
  modelDirName: "sd-turbo",
  defaultSize: "512x512",
  files: [
    {
      relativePath: "sd_turbo.safetensors",
      sizeBytes: 3_437_166_982,
      sources: sources(SD_TURBO_MS, SD_TURBO_HF, "sd_turbo.safetensors"),
    },
  ],
};

// ---------------------------------------------------------------------------
// CPU Models (sd.cpp in pure CPU mode)
// ---------------------------------------------------------------------------

/**
 * SD-Turbo CPU -- same model as GPU version but runs in CPU mode.
 * Slower (~60s/image) but works on any x86-64 machine with 2GB+ RAM.
 */
const SD_TURBO_CPU: ImageGenModelSpec = {
  id: "sd-turbo-cpu",
  displayName: "SD-Turbo (CPU, 慢速)",
  backend: "sd-cpp",
  sdType: "sd1",
  estimatedMemoryMB: 2000,
  downloadSizeMB: 3300,
  modelDirName: "sd-turbo", // Same model dir as GPU version
  defaultSize: "512x512",
  files: [
    {
      relativePath: "sd_turbo.safetensors",
      sizeBytes: 3_437_166_982,
      sources: sources(SD_TURBO_MS, SD_TURBO_HF, "sd_turbo.safetensors"),
    },
  ],
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const GPU_MODELS = {
  sdxlBase: SDXL_BASE_1_0,
  sdTurbo: SD_TURBO,
};

export const CPU_MODELS = {
  sdTurboCpu: SD_TURBO_CPU,
};

export const ALL_MODELS: Record<string, ImageGenModelSpec> = {
  "sdxl-base-1.0": SDXL_BASE_1_0,
  "sd-turbo": SD_TURBO,
  "sd-turbo-cpu": SD_TURBO_CPU,
};
