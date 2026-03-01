/**
 * Voice Router — unified API for ASR and TTS, tier-aware.
 *
 * Routes transcription/synthesis requests to the appropriate backend:
 *   - GPU sidecar (Qwen3-ASR / Qwen3-TTS) when running
 *   - sherpa-onnx (SenseVoice / Kokoro) for CPU tiers
 *   - Edge TTS fallback for online synthesis
 *
 * Also provides aggregated system status for the UI.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import { getHardwareSnapshot, refreshHardwareSnapshot } from "./hardware-detect.js";
import {
  getGpuSidecarState,
  gpuStreamSynthesize,
  gpuSynthesize,
  gpuTranscribe,
  isGpuSidecarRunning,
  isGpuStreamTtsReady,
  startGpuSidecar,
  stopGpuSidecar,
} from "./gpu-sidecar.js";
import { classifyVoiceTier, getModelsForTier } from "./voice-tier.js";
import { getModelInstallStates, isVoiceTierInstalled } from "./voice-install.js";
import type { VoiceSystemStatus, VoiceTierDecision, VoiceTierLevel } from "./types.js";
import {
  getVoicePrefsSync,
  isApiAsrProvider,
  isApiTtsProvider,
  loadVoicePrefs,
} from "./voice-prefs.js";

// ---------------------------------------------------------------------------
// Unified Transcribe
// ---------------------------------------------------------------------------

export interface TranscribeResult {
  ok: boolean;
  text?: string;
  latencyMs?: number;
  backend?: string;
  error?: string;
}

/**
 * Transcribe audio to text using the best available backend.
 *
 * Priority:
 *   0. User-selected API provider (if set and configured)
 *   1. GPU sidecar (Qwen3-ASR) if running
 *   2. sherpa-onnx (SenseVoice) if installed
 *   3. Error if nothing is available
 */
export async function unifiedTranscribe(audioBase64: string): Promise<TranscribeResult> {
  // Check user preference for API ASR
  const prefs = getVoicePrefsSync();
  if (isApiAsrProvider(prefs.asrProvider)) {
    try {
      const { transcribeViaApi } = await import("../gateway/server-methods/asr-streaming-api.js");
      const wavBuffer = Buffer.from(audioBase64, "base64");
      const text = await transcribeViaApi(wavBuffer);
      return { ok: true, text, backend: `api-${prefs.asrProvider}` };
    } catch (err) {
      return {
        ok: false,
        error: `API ASR failed: ${(err as Error).message}`,
        backend: `api-${prefs.asrProvider}`,
      };
    }
  }

  // Try GPU sidecar first
  if (isGpuSidecarRunning()) {
    const result = await gpuTranscribe(audioBase64);
    if (result.ok) {
      return {
        ok: true,
        text: result.text,
        latencyMs: result.latencyMs,
        backend: "qwen3-asr",
      };
    }
    // GPU sidecar failed, fall through to CPU
  }

  // Try sherpa-onnx SenseVoice — write base64 to temp file, then transcribe
  try {
    const { speechToText, detectInstalledModel } = await import("../agents/tools/asr-tool.js");
    const model = detectInstalledModel();
    if (model) {
      const tmpWav = path.join(
        os.tmpdir(),
        `openclawcn-asr-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.wav`,
      );
      try {
        fs.writeFileSync(tmpWav, Buffer.from(audioBase64, "base64"));
        const result = speechToText(tmpWav);
        if (result.success) {
          return {
            ok: true,
            text: result.text,
            latencyMs: result.latencyMs,
            backend: "sherpa-onnx",
          };
        }
        return { ok: false, error: result.error ?? "CPU ASR failed", backend: "sherpa-onnx" };
      } finally {
        try {
          fs.unlinkSync(tmpWav);
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    // sherpa-onnx not available
  }

  return { ok: false, error: "没有可用的语音识别后端" };
}

// ---------------------------------------------------------------------------
// Unified Synthesize
// ---------------------------------------------------------------------------

export interface SynthesizeResult {
  ok: boolean;
  audioBase64?: string;
  format?: string;
  latencyMs?: number;
  backend?: string;
  error?: string;
}

/**
 * Synthesize text to speech using the best available backend.
 *
 * Priority:
 *   0. User-selected API provider (if set and configured)
 *   1. GPU sidecar (Qwen3-TTS) if running with TTS enabled
 *   2. Kokoro (sherpa-onnx) if installed
 *   3. Edge TTS (online fallback)
 *   4. Error if nothing is available
 */
export async function unifiedSynthesize(text: string, voice?: string): Promise<SynthesizeResult> {
  // Check user preference for API TTS
  const ttsPrefs = getVoicePrefsSync();
  if (isApiTtsProvider(ttsPrefs.ttsProvider)) {
    try {
      const result = await apiSynthesize(
        text,
        ttsPrefs.ttsProvider!,
        ttsPrefs.ttsModel,
        ttsPrefs.ttsVoice ?? voice,
      );
      if (result.ok) return result;
      // Fall through to local backends if API fails
    } catch {
      // Fall through
    }
  }

  // Try GPU sidecar first
  if (isGpuSidecarRunning()) {
    const sidecarState = getGpuSidecarState();
    if (sidecarState.ttsReady) {
      const result = await gpuSynthesize(text, voice);
      if (result.ok) {
        return {
          ok: true,
          audioBase64: result.audioBase64,
          format: result.format,
          latencyMs: result.latencyMs,
          backend: "qwen3-tts",
        };
      }
      // GPU TTS failed, fall through
    }
  }

  // Try Kokoro (CPU offline TTS)
  try {
    const { isKokoroInstalled, kokoroSynthesize } = await import("../tts/tts-kokoro.js");
    if (isKokoroInstalled()) {
      const result = await kokoroSynthesize(text, voice);
      if (result.ok) {
        return {
          ok: true,
          audioBase64: result.audioBase64,
          format: result.format,
          latencyMs: result.latencyMs,
          backend: "kokoro",
        };
      }
    }
  } catch {
    // Kokoro not available
  }

  // Edge TTS fallback is handled by the main TTS pipeline (tts.ts).
  // The voice router only manages local/offline backends.
  return {
    ok: false,
    error: "没有可用的离线语音合成后端 (Edge TTS 可通过 TTS 系统使用)",
    backend: "none",
  };
}

// ---------------------------------------------------------------------------
// Unified Streaming Synthesize
// ---------------------------------------------------------------------------

/**
 * Whether streaming TTS is available (CosyVoice2 on GPU sidecar).
 */
export function isStreamTtsAvailable(): boolean {
  return isGpuStreamTtsReady();
}

/**
 * Stream TTS synthesis sentence by sentence.
 *
 * Calls `onChunk` for each audio chunk delivered from CosyVoice2.
 * Returns the total number of chunks delivered.
 */
export async function unifiedStreamSynthesize(
  text: string,
  onChunk: (audioBase64: string, format: string, index: number) => void,
): Promise<{ ok: boolean; chunks: number; error?: string }> {
  if (isGpuStreamTtsReady()) {
    return gpuStreamSynthesize(text, onChunk);
  }
  return { ok: false, chunks: 0, error: "流式 TTS 不可用 (CosyVoice2 未加载)" };
}

// ---------------------------------------------------------------------------
// API TTS helper
// ---------------------------------------------------------------------------

async function apiSynthesize(
  text: string,
  provider: string,
  model?: string,
  voice?: string,
): Promise<SynthesizeResult> {
  const { collectProviderApiKeys } = await import("../agents/live-auth-keys.js");

  // Provider → API key mapping
  const providerKeyMap: Record<string, string> = {
    openai: "openai",
    elevenlabs: "elevenlabs",
    dashscope: "dashscope",
    volcengine: "volcengine",
    minimax: "minimax",
  };

  // Edge TTS is handled directly (no API key needed)
  if (provider === "edge") {
    try {
      const { EdgeTTS } = await import("node-edge-tts");
      const tmpMp3 = path.join(
        os.tmpdir(),
        `openclawcn-edge-tts-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.mp3`,
      );
      const tts = new EdgeTTS({
        voice: voice || "zh-CN-XiaoxiaoNeural",
        lang: "zh-CN",
        outputFormat: "audio-24khz-48kbitrate-mono-mp3",
      });
      await tts.ttsPromise(text, tmpMp3);
      try {
        const audioBuffer = fs.readFileSync(tmpMp3);
        return {
          ok: true,
          audioBase64: audioBuffer.toString("base64"),
          format: "mp3",
          backend: "edge-tts",
        };
      } finally {
        try {
          fs.unlinkSync(tmpMp3);
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      return {
        ok: false,
        error: `Edge TTS failed: ${(err as Error).message}`,
        backend: "edge-tts",
      };
    }
  }

  const keyProvider = providerKeyMap[provider];
  if (!keyProvider) {
    return { ok: false, error: `Unknown TTS provider: ${provider}` };
  }

  // Volcengine TTS uses dedicated WebSocket binary protocol
  // Auth via unified credentials store or VOLC_APP_ID + VOLC_ACCESS_TOKEN env vars
  if (provider === "volcengine") {
    const { hasVolcengineVoiceCredentials } = await import("./volcengine-credentials.js");
    if (!hasVolcengineVoiceCredentials()) {
      return {
        ok: false,
        error: "未配置火山引擎语音凭证 — 请在模型设置 → 豆包 → 语音服务 Tab 中配置",
      };
    }
    try {
      const { volcengineTtsSynthesize } =
        await import("../gateway/server-methods/tts-volcengine.js");
      const userPrefs = getVoicePrefsSync();
      const result = await volcengineTtsSynthesize({
        text,
        voice: voice || userPrefs.ttsVoice || "BV405_streaming",
        speedRatio: userPrefs.ttsSpeedRatio,
        pitchRatio: userPrefs.ttsPitchRatio,
        emotion: userPrefs.ttsEmotion,
      });
      return {
        ok: true,
        audioBase64: result.audioBase64,
        format: result.format,
        backend: "api-volcengine",
      };
    } catch (err) {
      return {
        ok: false,
        error: `Volcengine TTS failed: ${(err as Error).message}`,
        backend: "api-volcengine",
      };
    }
  }

  const keys = collectProviderApiKeys(keyProvider);
  if (keys.length === 0) {
    return { ok: false, error: `No API key for TTS provider: ${provider}` };
  }
  const apiKey = keys[0]!;

  // Default voices/models per provider
  const defaultModels: Record<string, string> = {
    openai: "gpt-4o-mini-tts",
    elevenlabs: "eleven_multilingual_v2",
    dashscope: "cosyvoice-v2",
    volcengine: "tts",
    minimax: "speech-02-hd",
  };
  const defaultVoices: Record<string, string> = {
    openai: "alloy",
    elevenlabs: "pMsXgVXv3BLzUgSXRplE",
    dashscope: "longxiaochun",
    volcengine: "BV405_streaming",
    minimax: "male-qn-qingse",
  };

  const resolvedModel = model || defaultModels[provider] || "tts-1";
  const resolvedVoice = voice || defaultVoices[provider] || "alloy";

  // OpenAI-compatible TTS: openai, dashscope, volcengine, minimax, elevenlabs
  const baseUrls: Record<string, string> = {
    openai: "https://api.openai.com/v1",
    elevenlabs: "https://api.elevenlabs.io",
    dashscope: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    volcengine: "https://openspeech.bytedance.com/api/v1",
    minimax: "https://api.minimax.chat/v1",
  };

  const baseUrl = baseUrls[provider] ?? "https://api.openai.com/v1";

  if (provider === "elevenlabs") {
    // ElevenLabs has its own endpoint format
    const url = `${baseUrl}/v1/text-to-speech/${resolvedVoice}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: resolvedModel,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `ElevenLabs TTS error (${res.status})`,
        backend: "api-elevenlabs",
      };
    }
    const audioBuffer = Buffer.from(await res.arrayBuffer());
    return {
      ok: true,
      audioBase64: audioBuffer.toString("base64"),
      format: "mp3",
      backend: "api-elevenlabs",
    };
  }

  // Generic OpenAI-compatible /audio/speech endpoint
  const url = `${baseUrl}/audio/speech`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: resolvedModel,
      input: text,
      voice: resolvedVoice,
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    return { ok: false, error: `TTS API error (${res.status})`, backend: `api-${provider}` };
  }
  const audioBuffer = Buffer.from(await res.arrayBuffer());
  return {
    ok: true,
    audioBase64: audioBuffer.toString("base64"),
    format: "mp3",
    backend: `api-${provider}`,
  };
}

// ---------------------------------------------------------------------------
// System Status
// ---------------------------------------------------------------------------

/**
 * Get comprehensive voice system status for the UI.
 */
export async function getVoiceSystemStatus(): Promise<VoiceSystemStatus> {
  const hw = getHardwareSnapshot();
  const decision = classifyVoiceTier(hw);
  const sidecarState = getGpuSidecarState();
  const installed = isVoiceTierInstalled(decision.tier);
  const prefs = await loadVoicePrefs();

  // Determine ASR availability
  let asrAvailable = false;
  let asrBackend: VoiceSystemStatus["asrBackend"] = null;

  if (sidecarState.status === "running" && sidecarState.asrReady) {
    asrAvailable = true;
    asrBackend = "python-sidecar";
  } else if (decision.asrModel?.backend === "sherpa-onnx") {
    // Check if sherpa-onnx model is installed
    try {
      const { detectInstalledModel } = require("../agents/tools/asr-tool.js");
      const model = detectInstalledModel();
      if (model) {
        asrAvailable = true;
        asrBackend = "sherpa-onnx";
      }
    } catch {
      // sherpa-onnx not available
    }
  }

  // Determine TTS availability
  let ttsAvailable = false;
  let ttsBackend: VoiceSystemStatus["ttsBackend"] = null;

  if (sidecarState.status === "running" && sidecarState.ttsReady) {
    ttsAvailable = true;
    ttsBackend = "python-sidecar";
  } else if (decision.ttsModel?.backend === "sherpa-onnx") {
    try {
      const { isKokoroInstalled } = require("../tts/tts-kokoro.js");
      if (isKokoroInstalled()) {
        ttsAvailable = true;
        ttsBackend = "sherpa-onnx";
      }
    } catch {
      // Kokoro not available
    }
  } else if (decision.ttsModel?.backend === "edge-tts") {
    ttsAvailable = true;
    ttsBackend = "edge-tts";
  }

  // Load volcengine voice credentials (also populates process.env)
  let volcVoiceConfigured = false;
  try {
    const { getVolcengineVoiceCredentials } = await import("./volcengine-credentials.js");
    const creds = await getVolcengineVoiceCredentials();
    volcVoiceConfigured = !!creds;
  } catch {
    /* ignore */
  }

  // Check API availability
  let apiAsrAvailable = false;
  let apiTtsAvailable = false;
  try {
    const { collectProviderApiKeys } = await import("../agents/live-auth-keys.js");
    if (isApiAsrProvider(prefs.asrProvider)) {
      if (prefs.asrProvider === "volcengine") {
        apiAsrAvailable = volcVoiceConfigured;
      } else {
        const keys = collectProviderApiKeys(prefs.asrProvider!);
        apiAsrAvailable = keys.length > 0;
      }
      if (apiAsrAvailable) {
        asrAvailable = true;
        asrBackend = "api";
      }
    }
    if (isApiTtsProvider(prefs.ttsProvider)) {
      if (prefs.ttsProvider === "edge") {
        apiTtsAvailable = true;
      } else if (prefs.ttsProvider === "volcengine") {
        apiTtsAvailable = volcVoiceConfigured;
      } else {
        const keys = collectProviderApiKeys(prefs.ttsProvider!);
        apiTtsAvailable = keys.length > 0;
      }
      if (apiTtsAvailable) {
        ttsAvailable = true;
        ttsBackend = "api";
      }
    }
  } catch {
    // API check failed, continue with local-only status
  }

  // Volcengine voice: even without explicit prefs, mark as available for capability card
  if (volcVoiceConfigured && !asrAvailable) {
    asrAvailable = true;
    asrBackend = "api";
    apiAsrAvailable = true;
  }
  if (volcVoiceConfigured && !ttsAvailable) {
    ttsAvailable = true;
    ttsBackend = "api";
    apiTtsAvailable = true;
  }

  return {
    tier: decision,
    asrAvailable,
    asrBackend,
    ttsAvailable,
    ttsBackend,
    gpuSidecar: sidecarState.status !== "stopped" ? sidecarState : null,
    installState: installed ? "complete" : "idle",
    prefs,
    apiAsrAvailable,
    apiTtsAvailable,
  };
}

/**
 * Force-refresh hardware detection and re-classify tier.
 */
export function refreshVoiceTierStatus(): VoiceTierDecision {
  const hw = refreshHardwareSnapshot();
  return classifyVoiceTier(hw);
}

/**
 * Start the GPU sidecar if the tier requires it and models are installed.
 */
export async function autoStartGpuSidecar(): Promise<void> {
  const hw = getHardwareSnapshot();
  const decision = classifyVoiceTier(hw);

  if (decision.tier !== "gpu-full" && decision.tier !== "gpu-asr") {
    return; // Not a GPU tier
  }

  if (!isVoiceTierInstalled(decision.tier)) {
    return; // Models not installed
  }

  if (isGpuSidecarRunning()) {
    return; // Already running
  }

  const result = await startGpuSidecar(decision);
  if (!result.ok) {
    // Non-fatal: GPU sidecar failure shouldn't block gateway startup
    const { createSubsystemLogger } = await import("../logging/subsystem.js");
    const log = createSubsystemLogger("voice/router");
    log.warn(`Auto-start GPU sidecar failed: ${result.error}`);
  }
}

/**
 * Stop the GPU sidecar (for gateway shutdown).
 */
export async function shutdownVoice(): Promise<void> {
  await stopGpuSidecar();
}
