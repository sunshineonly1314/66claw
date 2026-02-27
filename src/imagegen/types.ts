/**
 * Image Generation Tier System -- Central type definitions.
 *
 * All imagegen modules import from here to avoid circular dependencies.
 * Pattern follows voice/types.ts.
 */

// Re-export hardware types from voice module (shared hardware detection)
export type { GpuInfo, HardwareSnapshot } from "../voice/types.js";

// ---------------------------------------------------------------------------
// Tier Classification
// ---------------------------------------------------------------------------

/**
 * Image generation capability tiers, ordered best to worst.
 *
 * - `gpu-hq`    : sd.cpp with full SDXL model, GPU accelerated (~4 GB VRAM)
 * - `gpu-fast`  : sd.cpp with SD1.5 or Turbo model, GPU accelerated (~2 GB VRAM)
 * - `cpu`       : sd.cpp in CPU mode, SD1.5 or smaller (~2 GB RAM, slow)
 * - `api-only`  : No local model, use cloud APIs (DashScope/SiliconFlow/OpenAI)
 * - `disabled`  : Hardware too weak for local, no API configured
 */
export type ImageGenTierLevel = "gpu-hq" | "gpu-fast" | "cpu" | "api-only" | "disabled";

export interface ImageGenTierDecision {
  tier: ImageGenTierLevel;
  model: ImageGenModelSpec | null;
  /** Human-readable reason for this classification (Chinese). */
  reason: string;
  hardware: import("../voice/types.js").HardwareSnapshot;
}

// ---------------------------------------------------------------------------
// Model Specifications
// ---------------------------------------------------------------------------

/** Execution backend for an image generation model. */
export type ImageGenModelBackend = "sd-cpp" | "comfyui" | "a1111" | "api-only";

export interface ImageGenModelDownloadSource {
  /** Mirror label for progress display (e.g. "魔搭", "hf-mirror"). */
  label: string;
  /** Full URL to the file. */
  url: string;
  /** Expected SHA-256 hex digest for integrity verification. */
  sha256?: string;
}

export interface ImageGenModelFile {
  /** Relative path within the model directory (e.g. "sd_xl_base_1.0.safetensors"). */
  relativePath: string;
  /** Approximate file size in bytes. */
  sizeBytes: number;
  /** Ordered download sources (primary, fallback, tertiary). */
  sources: ImageGenModelDownloadSource[];
}

export interface ImageGenModelSpec {
  /** Unique model identifier (e.g. "sdxl-base-1.0", "sd-turbo"). */
  id: string;
  /** Human-readable display name. */
  displayName: string;
  /** Execution backend. */
  backend: ImageGenModelBackend;
  /** sd.cpp model type flag: "sd1", "sd2", "sdxl", "sd3", "flux". */
  sdType?: string;
  /** Estimated runtime memory in MB (VRAM for GPU, RAM for CPU). */
  estimatedMemoryMB: number;
  /** Total download size in MB (sum of all files). */
  downloadSizeMB: number;
  /** Directory name under ~/.openclawcn/imagegen-models/ */
  modelDirName: string;
  /** Individual files to download. */
  files: ImageGenModelFile[];
  /** Default generation resolution. */
  defaultSize?: string;
}

// ---------------------------------------------------------------------------
// Installation State
// ---------------------------------------------------------------------------

export type ImageGenInstallStage =
  | "idle"
  | "detecting-hardware"
  | "downloading-sdcpp"
  | "downloading-models"
  | "verifying"
  | "testing"
  | "complete"
  | "failed";

export interface ImageGenInstallProgress {
  stage: ImageGenInstallStage;
  /** 0-100 overall percent. */
  percent: number;
  /** User-facing message (Chinese). */
  message: string;
  /** Optional detail line (e.g. current file, speed). */
  detail?: string;
  /** Which mirror is currently being used. */
  mirrorUsed?: string;
  /** Error message on failure. */
  error?: string;
}

export type ImageGenInstallCallback = (progress: ImageGenInstallProgress) => void;

// ---------------------------------------------------------------------------
// sd.cpp Sidecar
// ---------------------------------------------------------------------------

export type SdCppSidecarStatus = "stopped" | "starting" | "running" | "error";

export interface SdCppSidecarState {
  status: SdCppSidecarStatus;
  pid?: number;
  port: number;
  ready: boolean;
  error?: string;
  startedAt?: number;
  modelId?: string;
}

// ---------------------------------------------------------------------------
// Overall ImageGen System Status (returned by imagegen.tier.status RPC)
// ---------------------------------------------------------------------------

export interface ImageGenSystemStatus {
  tier: ImageGenTierDecision;
  localAvailable: boolean;
  localBackend: ImageGenModelBackend | null;
  sidecar: SdCppSidecarState | null;
  installState: ImageGenInstallStage;
  /** Installed model IDs found on disk. */
  installedModels: string[];
}
