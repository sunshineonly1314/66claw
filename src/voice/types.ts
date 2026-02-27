/**
 * Voice Capability Tier System -- Central type definitions.
 *
 * All voice-tier modules import from here to avoid circular dependencies.
 */

// ---------------------------------------------------------------------------
// Hardware Detection
// ---------------------------------------------------------------------------

export type GpuVendor = "nvidia" | "amd" | "intel" | "none";

export interface GpuInfo {
  vendor: GpuVendor;
  name: string;
  /** Total VRAM in megabytes. */
  vramTotalMB: number;
  /** Currently free VRAM in megabytes. */
  vramFreeMB: number;
  driverVersion: string;
  /** CUDA version reported by nvidia-smi (NVIDIA only). */
  cudaVersion?: string;
}

export interface HardwareSnapshot {
  gpu: GpuInfo | null;
  totalRamMB: number;
  freeRamMB: number;
  cpuModel: string;
  cpuCores: number;
  platform: NodeJS.Platform;
  arch: string;
  /** Unix epoch ms when this snapshot was taken. */
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Tier Classification
// ---------------------------------------------------------------------------

/**
 * Voice capability tier levels, ordered from best to worst.
 *
 * - `gpu-full`  : Qwen3-ASR + Qwen3-TTS on NVIDIA GPU (~6.3 GB VRAM)
 * - `gpu-asr`   : Qwen3-ASR on GPU + Edge TTS online  (~3.5 GB VRAM)
 * - `cpu-full`  : SenseVoice + Kokoro on CPU            (~1.9 GB RAM)
 * - `cpu-asr`   : SenseVoice on CPU + Edge TTS          (~450 MB RAM)
 * - `disabled`  : Hardware too weak, all voice features off
 */
export type VoiceTierLevel = "gpu-full" | "gpu-asr" | "cpu-full" | "cpu-asr" | "disabled";

export interface VoiceTierDecision {
  tier: VoiceTierLevel;
  asrModel: VoiceModelSpec | null;
  ttsModel: VoiceModelSpec | null;
  /** Human-readable reason for this classification (Chinese). */
  reason: string;
  hardware: HardwareSnapshot;
}

// ---------------------------------------------------------------------------
// Model Specifications
// ---------------------------------------------------------------------------

/** Execution backend for a voice model. */
export type VoiceModelBackend = "sherpa-onnx" | "python-sidecar" | "edge-tts" | "api";

// ---------------------------------------------------------------------------
// API Provider Selection (user preferences)
// ---------------------------------------------------------------------------

/** ASR provider the user can manually select. "auto" = hardware tier logic. */
export type VoiceAsrProvider =
  | "auto"
  | "openai"
  | "groq"
  | "deepgram"
  | "google"
  | "dashscope"
  | "volcengine";

/** TTS provider the user can manually select. "auto" = hardware tier logic. */
export type VoiceTtsProvider =
  | "auto"
  | "openai"
  | "elevenlabs"
  | "edge"
  | "dashscope"
  | "volcengine"
  | "minimax";

/** User-chosen voice backend preferences, saved to settings/voice-prefs.json. */
export interface VoicePrefs {
  asrProvider?: VoiceAsrProvider;
  asrModel?: string;
  ttsProvider?: VoiceTtsProvider;
  ttsModel?: string;
  ttsVoice?: string;
}

export interface VoiceModelDownloadSource {
  /** Mirror label for progress display (e.g. "ModelScope", "hf-mirror"). */
  label: string;
  /** Full URL to the file. */
  url: string;
  /** Expected SHA-256 hex digest for integrity verification. */
  sha256?: string;
}

export interface VoiceModelFile {
  /** Relative path within the model directory (e.g. "model.safetensors"). */
  relativePath: string;
  /** Approximate file size in bytes. */
  sizeBytes: number;
  /** Ordered download sources (primary, fallback, tertiary). */
  sources: VoiceModelDownloadSource[];
}

export interface VoiceModelSpec {
  /** Unique model identifier (e.g. "qwen3-asr-0.6b", "kokoro-82m"). */
  id: string;
  /** Human-readable display name. */
  displayName: string;
  /** Execution backend. */
  backend: VoiceModelBackend;
  /** Estimated runtime memory in MB (VRAM for GPU models, RAM for CPU). */
  estimatedMemoryMB: number;
  /** Total download size in MB (sum of all files). */
  downloadSizeMB: number;
  /** Directory name under ~/.openclawcn/voice-models/ */
  modelDirName: string;
  /** Individual files to download. */
  files: VoiceModelFile[];
}

// ---------------------------------------------------------------------------
// Installation State
// ---------------------------------------------------------------------------

export type VoiceInstallStage =
  | "idle"
  | "detecting-hardware"
  | "checking-python"
  | "creating-venv"
  | "installing-deps"
  | "downloading-models"
  | "verifying"
  | "starting-server"
  | "complete"
  | "failed";

export interface VoiceInstallProgress {
  stage: VoiceInstallStage;
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

export type VoiceInstallCallback = (progress: VoiceInstallProgress) => void;

// ---------------------------------------------------------------------------
// GPU Python Sidecar
// ---------------------------------------------------------------------------

export type GpuSidecarStatus = "stopped" | "starting" | "running" | "error";

export interface GpuSidecarState {
  status: GpuSidecarStatus;
  pid?: number;
  port: number;
  asrReady: boolean;
  ttsReady: boolean;
  /** CosyVoice2 streaming TTS is available. */
  streamTtsReady: boolean;
  error?: string;
  startedAt?: number;
}

// ---------------------------------------------------------------------------
// Overall Voice System Status (returned by voice.tier.status RPC)
// ---------------------------------------------------------------------------

export interface VoiceSystemStatus {
  tier: VoiceTierDecision;
  asrAvailable: boolean;
  asrBackend: VoiceModelBackend | null;
  ttsAvailable: boolean;
  ttsBackend: VoiceModelBackend | null;
  gpuSidecar: GpuSidecarState | null;
  installState: VoiceInstallStage;
  /** User-selected voice backend preferences. */
  prefs?: VoicePrefs;
  /** Whether an API ASR provider is configured and has an API key. */
  apiAsrAvailable?: boolean;
  /** Whether an API TTS provider is configured and has an API key. */
  apiTtsAvailable?: boolean;
}
