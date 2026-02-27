/**
 * GPU Sidecar — manages the Python FastAPI voice server process.
 *
 * Lifecycle: spawn → health-check polling → auto-restart on crash → graceful shutdown.
 *
 * The sidecar runs Qwen3-ASR and/or Qwen3-TTS on NVIDIA GPU via PyTorch.
 * Node.js communicates with it over HTTP on localhost:50100.
 *
 * Pattern follows:
 *   - signal/daemon.ts for spawn/handle
 *   - sidecar.rs for auto-restart monitor + intentional stop flag
 *   - provider-health.ts for exponential backoff on failures
 */

import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { createSubsystemLogger } from "../logging/subsystem.js";

import type { GpuSidecarState, VoiceTierDecision } from "./types.js";
import { VOICE_ENV_DIR, VOICE_MODELS_DIR } from "./voice-install.js";

const log = createSubsystemLogger("voice/gpu-sidecar");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PORT = 51200;
const HEALTH_CHECK_INTERVAL_MS = 10_000;
const HEALTH_CHECK_TIMEOUT_MS = 15_000; // Increased: CosyVoice2 GPU inference blocks the Python event loop
const HEALTH_CHECK_MAX_FAILURES = 6; // ~60s tolerance during heavy TTS inference
const STARTUP_TIMEOUT_MS = 120_000; // Models may take time to load into VRAM
const MAX_RESTART_ATTEMPTS = 3;
const RESTART_DELAY_MS = 2_000;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _process: ChildProcess | null = null;
let _state: GpuSidecarState = {
  status: "stopped",
  port: DEFAULT_PORT,
  asrReady: false,
  ttsReady: false,
  streamTtsReady: false,
};
let _healthCheckTimer: ReturnType<typeof setInterval> | null = null;
let _intentionalStop = false;
let _restartCount = 0;
let _startedDecision: VoiceTierDecision | null = null;
let _activeTtsRequests = 0; // Track in-flight stream TTS requests

// ---------------------------------------------------------------------------
// Python Path Resolution
// ---------------------------------------------------------------------------

function getVenvPython(): string {
  return process.platform === "win32"
    ? path.join(VOICE_ENV_DIR, "Scripts", "python.exe")
    : path.join(VOICE_ENV_DIR, "bin", "python");
}

/**
 * Resolve the bundled voice-server.py script path.
 * Checked locations (dev → dist → cwd):
 */
function getVoiceServerScript(): string {
  const candidates = [
    path.join(import.meta.dirname, "..", "..", "resources", "voice-server.py"),
    path.join(import.meta.dirname, "..", "resources", "voice-server.py"),
    path.join(process.cwd(), "resources", "voice-server.py"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  // Return first candidate; error will surface at spawn time
  return candidates[0]!;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the current sidecar state (non-blocking).
 */
export function getGpuSidecarState(): GpuSidecarState {
  return { ..._state };
}

/**
 * Start the GPU voice sidecar.
 *
 * Spawns the Python FastAPI server with the appropriate model flags
 * based on the tier decision. Waits for the `/health` endpoint to respond
 * before resolving.
 */
export async function startGpuSidecar(
  decision: VoiceTierDecision,
  port: number = DEFAULT_PORT,
): Promise<{ ok: boolean; error?: string }> {
  // Already running or starting?
  if (_process && (_state.status === "running" || _state.status === "starting")) {
    return { ok: true };
  }

  // Pre-flight checks
  const venvPython = getVenvPython();
  if (!fs.existsSync(venvPython)) {
    const error = `Python 虚拟环境未找到: ${venvPython}`;
    log.error(error);
    _state = { ..._state, status: "error", error };
    return { ok: false, error };
  }

  const scriptPath = getVoiceServerScript();
  if (!fs.existsSync(scriptPath)) {
    const error = `语音服务脚本未找到: ${scriptPath}`;
    log.error(error);
    _state = { ..._state, status: "error", error };
    return { ok: false, error };
  }

  _intentionalStop = false;
  _startedDecision = decision;
  _state = {
    status: "starting",
    port,
    asrReady: false,
    ttsReady: false,
    streamTtsReady: false,
    startedAt: Date.now(),
  };

  // Build command args
  const args = [scriptPath, "--port", String(port)];

  // Tell the server which models to load based on tier
  const asrModelDir = decision.asrModel
    ? path.join(VOICE_MODELS_DIR, decision.asrModel.modelDirName)
    : null;

  if (asrModelDir && fs.existsSync(asrModelDir)) {
    args.push("--asr-model-dir", asrModelDir);
  }

  // TTS hidden in this release — skip --tts-model-dir and --cosyvoice-model-dir
  // to save GPU VRAM and startup time. voice-server.py will print "TTS disabled".

  log.info(`Starting GPU sidecar: ${venvPython} ${args.join(" ")}`);

  try {
    // Build PYTHONPATH for CosyVoice2 source (not pip-installable).
    // CosyVoice repo is cloned to the install root (sibling of data/).
    // VOICE_MODELS_DIR = E:\openclawcn\data\.openclawcn\voice-models
    // CosyVoice source = E:\openclawcn\CosyVoice
    const installRoot = path.resolve(VOICE_MODELS_DIR, "..", "..", "..");
    const cosyvoiceSrcDir = path.join(installRoot, "CosyVoice");
    const cosyvoiceThirdParty = path.join(cosyvoiceSrcDir, "third_party", "Matcha-TTS");
    const existingPythonPath = process.env.PYTHONPATH ?? "";
    const extraPythonPaths = [cosyvoiceSrcDir, cosyvoiceThirdParty]
      .filter((p) => fs.existsSync(p))
      .join(path.delimiter);
    const pythonPath = extraPythonPaths
      ? existingPythonPath
        ? `${extraPythonPaths}${path.delimiter}${existingPythonPath}`
        : extraPythonPaths
      : existingPythonPath;

    _process = spawn(venvPython, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: {
        ...process.env,
        // Ensure CUDA is visible
        CUDA_VISIBLE_DEVICES: process.env.CUDA_VISIBLE_DEVICES ?? "0",
        // Force transformers to only use local model files — never reach out
        // to HuggingFace (blocked for CN users). The model directory already
        // has all required files (config.json, tokenizer_config.json, etc.).
        TRANSFORMERS_OFFLINE: "1",
        HF_HUB_OFFLINE: "1",
        // If for any reason something slips through, redirect to CN mirror
        HF_ENDPOINT: "https://hf-mirror.com",
        // CosyVoice2 source + Matcha-TTS third_party
        ...(pythonPath ? { PYTHONPATH: pythonPath } : {}),
      },
    });

    // Pipe stdout/stderr to logger
    _process.stdout?.on("data", (data: Buffer) => {
      for (const line of data.toString().split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed) log.info(`[py] ${trimmed}`);
      }
    });

    _process.stderr?.on("data", (data: Buffer) => {
      for (const line of data.toString().split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed) log.warn(`[py] ${trimmed}`);
      }
    });

    _process.on("error", (err) => {
      log.error(`Sidecar spawn error: ${err.message}`);
      _state = { ..._state, status: "error", error: err.message };
    });

    _process.on("exit", (code, signal) => {
      log.info(`Sidecar exited: code=${code}, signal=${signal}`);
      _process = null;
      _state = {
        ..._state,
        status: "stopped",
        pid: undefined,
        asrReady: false,
        ttsReady: false,
        streamTtsReady: false,
      };

      // Auto-restart on unexpected exit
      if (!_intentionalStop && _restartCount < MAX_RESTART_ATTEMPTS) {
        _restartCount++;
        log.warn(
          `Unexpected exit, restarting (attempt ${_restartCount}/${MAX_RESTART_ATTEMPTS})...`,
        );
        setTimeout(() => {
          if (!_intentionalStop && _startedDecision) {
            startGpuSidecar(_startedDecision, port).catch((err) => {
              log.error(`Auto-restart failed: ${(err as Error).message}`);
            });
          }
        }, RESTART_DELAY_MS * _restartCount); // Linear backoff
      }
    });

    _state = { ..._state, pid: _process.pid };

    // Wait for health endpoint
    const healthResult = await waitForHealth(port);
    if (!healthResult.ok) {
      await stopGpuSidecar();
      return { ok: false, error: healthResult.error };
    }

    _state = {
      ..._state,
      status: "running",
      asrReady: healthResult.asrReady,
      ttsReady: healthResult.ttsReady,
      streamTtsReady: healthResult.streamTtsReady,
    };
    _restartCount = 0; // Reset on successful start

    // Start health check polling
    startHealthCheckPolling(port);

    log.info(
      `GPU sidecar running on port ${port} (PID ${_state.pid}), ASR=${healthResult.asrReady}, TTS=${healthResult.ttsReady}, StreamTTS=${healthResult.streamTtsReady}`,
    );
    return { ok: true };
  } catch (err) {
    const error = `启动 GPU 语音服务失败: ${(err as Error).message}`;
    log.error(error);
    _state = { ..._state, status: "error", error };
    return { ok: false, error };
  }
}

/**
 * Gracefully stop the GPU sidecar.
 */
export async function stopGpuSidecar(): Promise<void> {
  _intentionalStop = true;

  // Stop health check polling
  if (_healthCheckTimer) {
    clearInterval(_healthCheckTimer);
    _healthCheckTimer = null;
  }

  if (!_process) {
    _state = {
      ..._state,
      status: "stopped",
      pid: undefined,
      asrReady: false,
      ttsReady: false,
      streamTtsReady: false,
    };
    return;
  }

  log.info("Stopping GPU sidecar...");

  const child = _process;
  _process = null;

  // Try graceful shutdown first (POST /shutdown)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    await fetch(`http://127.0.0.1:${_state.port}/shutdown`, {
      method: "POST",
      signal: controller.signal,
    }).catch(() => {}); // Ignore errors
    clearTimeout(timeout);
  } catch {
    // Graceful shutdown request failed, fall through to kill
  }

  // Give it 3 seconds to exit gracefully
  const exited = await waitForExit(child, 3000);

  if (!exited) {
    // Force kill
    log.warn("Sidecar did not exit gracefully, force killing...");
    try {
      if (process.platform === "win32") {
        // On Windows, use taskkill to kill the process tree
        const { execFileSync } = await import("node:child_process");
        if (child.pid) {
          execFileSync("taskkill", ["/F", "/T", "/PID", String(child.pid)], {
            timeout: 5000,
            stdio: "pipe",
            windowsHide: true,
          });
        }
      } else {
        child.kill("SIGKILL");
      }
    } catch {
      // Process may already be dead
    }
  }

  _state = {
    ..._state,
    status: "stopped",
    pid: undefined,
    asrReady: false,
    ttsReady: false,
    streamTtsReady: false,
  };
  _startedDecision = null;
  log.info("GPU sidecar stopped");
}

/**
 * Whether the sidecar is currently running.
 */
export function isGpuSidecarRunning(): boolean {
  return _state.status === "running" && _process !== null;
}

// ---------------------------------------------------------------------------
// Transcribe / Synthesize via HTTP
// ---------------------------------------------------------------------------

/**
 * Send audio to the GPU sidecar for transcription.
 * @param audioBase64 Base64-encoded audio (WAV or raw PCM)
 * @returns Transcribed text
 */
export async function gpuTranscribe(audioBase64: string): Promise<{
  ok: boolean;
  text?: string;
  latencyMs?: number;
  error?: string;
}> {
  if (!isGpuSidecarRunning()) {
    return { ok: false, error: "GPU sidecar is not running" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000); // 60s for long audio

    const response = await fetch(`http://127.0.0.1:${_state.port}/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio_base64: audioBase64 }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown error");
      return { ok: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = (await response.json()) as { text: string; latency_ms: number };
    return { ok: true, text: result.text, latencyMs: result.latency_ms };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Send text to the GPU sidecar for speech synthesis.
 * @param text Text to synthesize
 * @param voice Optional voice/speaker ID
 * @returns Base64-encoded WAV audio
 */
export async function gpuSynthesize(
  text: string,
  voice?: string,
): Promise<{
  ok: boolean;
  audioBase64?: string;
  format?: string;
  latencyMs?: number;
  error?: string;
}> {
  if (!isGpuSidecarRunning()) {
    return { ok: false, error: "GPU sidecar is not running" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const response = await fetch(`http://127.0.0.1:${_state.port}/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown error");
      return { ok: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = (await response.json()) as {
      audio_base64: string;
      format: string;
      latency_ms: number;
    };
    return {
      ok: true,
      audioBase64: result.audio_base64,
      format: result.format,
      latencyMs: result.latency_ms,
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Serial queue for TTS requests — CosyVoice can only handle one inference
 * at a time. Concurrent requests cause extreme slowdowns and dropped data.
 */
let _ttsQueue: Promise<unknown> = Promise.resolve();

/**
 * Stream TTS synthesis from the GPU sidecar (CosyVoice).
 *
 * POSTs to /stream-tts, reads length-prefixed PCM16 chunks,
 * converts each to a base64 WAV, and invokes `onChunk` per chunk.
 * Requests are serialized — only one inference runs at a time.
 *
 * @returns Total number of chunks delivered.
 */
export function gpuStreamSynthesize(
  text: string,
  onChunk: (audioBase64: string, format: string, index: number) => void,
): Promise<{ ok: boolean; chunks: number; error?: string }> {
  if (!isGpuSidecarRunning() || !_state.streamTtsReady) {
    return Promise.resolve({ ok: false, chunks: 0, error: "Stream TTS not available" });
  }

  // Chain onto the serial queue so requests run one at a time
  const result = _ttsQueue.then(() => _gpuStreamSynthesizeImpl(text, onChunk));
  _ttsQueue = result.catch(() => {}); // swallow errors in the chain
  return result;
}

async function _gpuStreamSynthesizeImpl(
  text: string,
  onChunk: (audioBase64: string, format: string, index: number) => void,
): Promise<{ ok: boolean; chunks: number; error?: string }> {
  _activeTtsRequests++;
  log.info(
    `[stream-tts-fetch] starting request, text="${text.slice(0, 30)}..." activeTts=${_activeTtsRequests}`,
  );
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    const response = await fetch(`http://127.0.0.1:${_state.port}/stream-tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    log.info(`[stream-tts-fetch] response status=${response.status}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown error");
      log.warn(`[stream-tts-fetch] HTTP error: ${response.status} ${errorText}`);
      return { ok: false, chunks: 0, error: `HTTP ${response.status}: ${errorText}` };
    }

    if (!response.body) {
      log.warn("[stream-tts-fetch] No response body");
      return { ok: false, chunks: 0, error: "No response body" };
    }

    // Read the streaming response: [4 bytes length LE][PCM16 data] repeating
    const reader = response.body.getReader();
    let buffer = Buffer.alloc(0);
    let chunkIndex = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer = Buffer.concat([buffer, Buffer.from(value)]);

      // Process complete chunks from buffer
      while (buffer.length >= 4) {
        const chunkSize = buffer.readUInt32LE(0);
        if (buffer.length < 4 + chunkSize) break; // Wait for more data

        const pcmData = buffer.subarray(4, 4 + chunkSize);
        buffer = buffer.subarray(4 + chunkSize);

        // Convert PCM16 to WAV and base64
        const wavBase64 = pcm16ToWavBase64(pcmData, 24000);
        onChunk(wavBase64, "wav", chunkIndex);
        chunkIndex++;
      }
    }

    log.info(`[stream-tts-fetch] done, chunks=${chunkIndex}`);
    return { ok: true, chunks: chunkIndex };
  } catch (err) {
    log.warn(`[stream-tts-fetch] error: ${(err as Error).message}`);
    return { ok: false, chunks: 0, error: (err as Error).message };
  } finally {
    _activeTtsRequests = Math.max(0, _activeTtsRequests - 1);
  }
}

/**
 * Whether the GPU sidecar has streaming TTS (CosyVoice2) ready.
 */
export function isGpuStreamTtsReady(): boolean {
  return _state.status === "running" && _state.streamTtsReady;
}

/**
 * Convert raw PCM16 mono data to a WAV file encoded as base64.
 */
function pcm16ToWavBase64(pcmData: Buffer, sampleRate: number): string {
  const numSamples = pcmData.length / 2;
  const byteRate = sampleRate * 2; // 16-bit mono
  const wavSize = 44 + pcmData.length;

  const wav = Buffer.alloc(wavSize);
  let offset = 0;

  // RIFF header
  wav.write("RIFF", offset);
  offset += 4;
  wav.writeUInt32LE(wavSize - 8, offset);
  offset += 4;
  wav.write("WAVE", offset);
  offset += 4;

  // fmt chunk
  wav.write("fmt ", offset);
  offset += 4;
  wav.writeUInt32LE(16, offset);
  offset += 4; // chunk size
  wav.writeUInt16LE(1, offset);
  offset += 2; // PCM format
  wav.writeUInt16LE(1, offset);
  offset += 2; // mono
  wav.writeUInt32LE(sampleRate, offset);
  offset += 4;
  wav.writeUInt32LE(byteRate, offset);
  offset += 4;
  wav.writeUInt16LE(2, offset);
  offset += 2; // block align
  wav.writeUInt16LE(16, offset);
  offset += 2; // bits per sample

  // data chunk
  wav.write("data", offset);
  offset += 4;
  wav.writeUInt32LE(pcmData.length, offset);
  offset += 4;
  pcmData.copy(wav, offset);

  return wav.toString("base64");
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

/**
 * Wait for the sidecar's /health endpoint to respond.
 * Polls every 2 seconds up to STARTUP_TIMEOUT_MS.
 */
async function waitForHealth(port: number): Promise<{
  ok: boolean;
  asrReady: boolean;
  ttsReady: boolean;
  streamTtsReady: boolean;
  error?: string;
}> {
  const startTime = Date.now();
  const pollInterval = 2000;

  while (Date.now() - startTime < STARTUP_TIMEOUT_MS) {
    // Check if process died during startup
    if (!_process || _process.exitCode !== null) {
      return {
        ok: false,
        asrReady: false,
        ttsReady: false,
        streamTtsReady: false,
        error: "进程启动失败，已退出",
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

      const response = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = (await response.json()) as {
          asr: boolean;
          tts: boolean;
          stream_tts?: boolean;
        };
        // At least one model must be ready
        if (data.asr || data.tts || data.stream_tts) {
          return {
            ok: true,
            asrReady: data.asr,
            ttsReady: data.tts,
            streamTtsReady: !!data.stream_tts,
          };
        }
      }
    } catch {
      // Server not ready yet, continue polling
    }

    await sleep(pollInterval);
  }

  return {
    ok: false,
    asrReady: false,
    ttsReady: false,
    streamTtsReady: false,
    error: `GPU 语音服务启动超时 (${STARTUP_TIMEOUT_MS / 1000}s)`,
  };
}

/**
 * Start periodic health check polling.
 * If the sidecar becomes unreachable, mark it as error.
 */
function startHealthCheckPolling(port: number): void {
  if (_healthCheckTimer) {
    clearInterval(_healthCheckTimer);
  }

  let consecutiveFailures = 0;

  _healthCheckTimer = setInterval(async () => {
    if (_intentionalStop || !_process) {
      if (_healthCheckTimer) {
        clearInterval(_healthCheckTimer);
        _healthCheckTimer = null;
      }
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

      const response = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = (await response.json()) as {
          asr: boolean;
          tts: boolean;
          stream_tts?: boolean;
        };
        consecutiveFailures = 0;
        _state = {
          ..._state,
          status: "running",
          asrReady: data.asr,
          ttsReady: data.tts,
          streamTtsReady: !!data.stream_tts,
          error: undefined,
        };
      } else {
        // Don't count failures while TTS inference is in progress —
        // CosyVoice2 GPU inference can block the Python event loop.
        if (_activeTtsRequests === 0) consecutiveFailures++;
      }
    } catch {
      if (_activeTtsRequests === 0) consecutiveFailures++;
    }

    if (consecutiveFailures >= HEALTH_CHECK_MAX_FAILURES) {
      log.error(`Health check failed ${consecutiveFailures} times, attempting restart`);
      _state = {
        ..._state,
        status: "error",
        asrReady: false,
        ttsReady: false,
        streamTtsReady: false,
        error: "健康检查连续失败，正在重启",
      };

      // Stop polling and trigger restart
      if (_healthCheckTimer) {
        clearInterval(_healthCheckTimer);
        _healthCheckTimer = null;
      }

      if (_restartCount < MAX_RESTART_ATTEMPTS && _startedDecision) {
        _restartCount++;
        const savedDecision = _startedDecision; // Save before stop() nullifies it
        log.warn(
          `Health-check triggered restart (attempt ${_restartCount}/${MAX_RESTART_ATTEMPTS})`,
        );
        // Stop current process, then restart
        stopGpuSidecar()
          .then(() => {
            _intentionalStop = false; // Clear the flag so restart can proceed
            startGpuSidecar(savedDecision, port).catch((err) => {
              log.error(`Health-check restart failed: ${(err as Error).message}`);
            });
          })
          .catch((err) => {
            log.error(`Health-check stop failed: ${(err as Error).message}`);
          });
      } else {
        log.error("Max restart attempts reached, sidecar will remain stopped");
      }
    }
  }, HEALTH_CHECK_INTERVAL_MS);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for a child process to exit within a timeout.
 * Returns true if the process exited, false if timeout was reached.
 */
function waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);

    child.on("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });

    // Check if already exited
    if (child.exitCode !== null || child.signalCode !== null) {
      clearTimeout(timer);
      resolve(true);
    }
  });
}
