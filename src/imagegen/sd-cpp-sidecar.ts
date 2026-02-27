/**
 * sd.cpp Sidecar -- manages the stable-diffusion.cpp process.
 *
 * sd.cpp exposes an OpenAI-compatible API on localhost when run in server mode:
 *   ./sd --mode server --port 50200 --model <path>
 *
 * Lifecycle: spawn -> health-check polling -> auto-restart on crash -> graceful shutdown.
 * Pattern follows voice/gpu-sidecar.ts.
 */

import { spawn, execSync, type ChildProcess } from "node:child_process";
import path from "node:path";

import { createSubsystemLogger } from "../logging/subsystem.js";
import { getSdCppBinaryPath, IMAGEGEN_BIN_DIR, IMAGEGEN_MODELS_DIR } from "./imagegen-install.js";
import type { ImageGenTierDecision, SdCppSidecarState } from "./types.js";

const log = createSubsystemLogger("imagegen/sd-cpp-sidecar");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PORT = 50200;
const HEALTH_CHECK_INTERVAL_MS = 10_000;
const HEALTH_CHECK_TIMEOUT_MS = 5_000;
const STARTUP_TIMEOUT_MS = 180_000; // Model loading can take time
const MAX_RESTART_ATTEMPTS = 3;
const RESTART_DELAY_MS = 3_000;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _process: ChildProcess | null = null;
let _state: SdCppSidecarState = {
  status: "stopped",
  port: DEFAULT_PORT,
  ready: false,
};
let _healthCheckTimer: ReturnType<typeof setInterval> | null = null;
let _intentionalStop = false;
let _restartCount = 0;
let _startedDecision: ImageGenTierDecision | null = null;
/** Mutex: in-flight start promise prevents concurrent spawns (C2 fix). */
let _startPromise: Promise<{ ok: boolean; state: SdCppSidecarState; error?: string }> | null = null;
/** Pending auto-restart timeout handle (M1 fix -- cleared on stop). */
let _restartTimer: ReturnType<typeof setTimeout> | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get current sidecar state (read-only snapshot).
 */
export function getSdCppSidecarState(): SdCppSidecarState {
  return { ..._state };
}

/**
 * Start the sd.cpp sidecar process.
 */
export async function startSdCppSidecar(
  decision: ImageGenTierDecision,
): Promise<{ ok: boolean; state: SdCppSidecarState; error?: string }> {
  if (_state.status === "running" || _state.status === "starting") {
    return { ok: true, state: { ..._state } };
  }
  // Mutex: if another start is in-flight, wait for it instead of spawning again (C2 fix)
  if (_startPromise) return _startPromise;

  _intentionalStop = false;
  _restartCount = 0;
  _startedDecision = decision;
  // Cancel any pending auto-restart from a previous crash
  if (_restartTimer) {
    clearTimeout(_restartTimer);
    _restartTimer = null;
  }

  _startPromise = doStart(decision).finally(() => {
    _startPromise = null;
  });
  return _startPromise;
}

/**
 * Stop the sd.cpp sidecar process.
 */
export async function stopSdCppSidecar(): Promise<void> {
  _intentionalStop = true;
  if (_restartTimer) {
    clearTimeout(_restartTimer);
    _restartTimer = null;
  }
  stopHealthCheck();

  if (!_process) {
    _state = { status: "stopped", port: DEFAULT_PORT, ready: false };
    return;
  }

  const pid = _process.pid;
  log.info(`Stopping sd.cpp sidecar (PID=${pid})...`);

  // Try graceful shutdown first
  try {
    _process.kill("SIGTERM");
  } catch {
    // Ignore
  }

  // Wait 5 seconds for graceful exit
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      // Force kill
      if (_process && !_process.killed) {
        try {
          if (process.platform === "win32" && pid) {
            execSync(`taskkill /F /T /PID ${pid}`, {
              timeout: 5_000,
              stdio: "pipe",
              windowsHide: true,
            });
          } else {
            _process.kill("SIGKILL");
          }
        } catch {
          /* ignore */
        }
      }
      resolve();
    }, 5_000);

    _process?.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });

  _process = null;
  _state = { status: "stopped", port: DEFAULT_PORT, ready: false };
  _startedDecision = null;
  log.info("sd.cpp sidecar stopped");
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function doStart(
  decision: ImageGenTierDecision,
): Promise<{ ok: boolean; state: SdCppSidecarState; error?: string }> {
  const model = decision.model;
  if (!model) {
    const errMsg = "No model specified in tier decision";
    _state = { status: "error", port: DEFAULT_PORT, ready: false, error: errMsg };
    return { ok: false, state: { ..._state }, error: errMsg };
  }

  const sdCppPath = getSdCppBinaryPath();
  const modelDir = path.join(IMAGEGEN_MODELS_DIR, model.modelDirName);
  const modelFile = model.files[0]?.relativePath;

  if (!modelFile) {
    const errMsg = "No model file defined";
    _state = { status: "error", port: DEFAULT_PORT, ready: false, error: errMsg };
    return { ok: false, state: { ..._state }, error: errMsg };
  }

  const modelPath = path.join(modelDir, modelFile);

  // Build command args for sd.cpp server mode
  const args: string[] = ["--mode", "server", "--port", String(DEFAULT_PORT), "--model", modelPath];

  // Add model-specific flags
  if (model.sdType) {
    args.push("--type", model.sdType);
  }

  // Use GPU if available, CPU otherwise
  if (decision.tier === "cpu") {
    args.push(
      "--threads",
      String(Math.max(2, Math.floor((decision.hardware.cpuCores || 4) * 0.75))),
    );
  }

  log.info(`Starting sd.cpp: ${sdCppPath} ${args.join(" ")}`);

  _state = {
    status: "starting",
    port: DEFAULT_PORT,
    ready: false,
    modelId: model.id,
  };

  try {
    const env: Record<string, string> = { ...process.env };
    // Prevent model re-downloading
    env.HF_HUB_OFFLINE = "1";
    env.TRANSFORMERS_OFFLINE = "1";

    _process = spawn(sdCppPath, args, {
      cwd: IMAGEGEN_BIN_DIR,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    _state.pid = _process.pid;

    // Log output
    _process.stdout?.on("data", (data: Buffer) => {
      const line = data.toString().trim();
      if (line) log.debug(`[sd.cpp stdout] ${line}`);
    });
    _process.stderr?.on("data", (data: Buffer) => {
      const line = data.toString().trim();
      if (line) log.debug(`[sd.cpp stderr] ${line}`);
    });

    // Handle exit
    _process.on("exit", (code, signal) => {
      log.info(`sd.cpp exited: code=${code}, signal=${signal}`);
      _process = null;
      stopHealthCheck();

      if (!_intentionalStop && _restartCount < MAX_RESTART_ATTEMPTS && _startedDecision) {
        _restartCount++;
        const delay = RESTART_DELAY_MS * _restartCount;
        log.info(`Auto-restart attempt ${_restartCount}/${MAX_RESTART_ATTEMPTS} in ${delay}ms...`);
        _restartTimer = setTimeout(() => {
          _restartTimer = null;
          if (!_intentionalStop && _startedDecision) {
            doStart(_startedDecision).catch((err) => {
              log.error(`Auto-restart failed: ${(err as Error).message}`);
            });
          }
        }, delay);
      } else {
        _state = {
          status: _intentionalStop ? "stopped" : "error",
          port: DEFAULT_PORT,
          ready: false,
          error: _intentionalStop ? undefined : `Process exited with code ${code}`,
        };
      }
    });

    // Wait for health check
    const healthy = await waitForHealth(DEFAULT_PORT, STARTUP_TIMEOUT_MS);
    if (!healthy) {
      const errMsg = "sd.cpp failed to become healthy within timeout";
      log.error(errMsg);
      await stopSdCppSidecar();
      _state = { status: "error", port: DEFAULT_PORT, ready: false, error: errMsg };
      return { ok: false, state: { ..._state }, error: errMsg };
    }

    _state = {
      status: "running",
      pid: _process?.pid,
      port: DEFAULT_PORT,
      ready: true,
      startedAt: Date.now(),
      modelId: model.id,
    };

    startHealthCheck();
    log.info(`sd.cpp sidecar running on port ${DEFAULT_PORT}`);
    return { ok: true, state: { ..._state } };
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error(`Failed to start sd.cpp: ${errMsg}`);
    _state = { status: "error", port: DEFAULT_PORT, ready: false, error: errMsg };
    return { ok: false, state: { ..._state }, error: errMsg };
  }
}

/**
 * Poll health endpoint until ready or timeout.
 */
async function waitForHealth(port: number, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  const pollInterval = 2_000;

  while (Date.now() - start < timeoutMs) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
      const resp = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (resp.ok) return true;
    } catch {
      // Not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }
  return false;
}

/**
 * Periodic health check.
 */
function startHealthCheck(): void {
  stopHealthCheck();
  let failCount = 0;

  _healthCheckTimer = setInterval(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
      const resp = await fetch(`http://127.0.0.1:${_state.port}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (resp.ok) {
        failCount = 0;
        _state.ready = true;
        _state.status = "running";
      } else {
        failCount++;
      }
    } catch {
      failCount++;
    }

    if (failCount >= 3) {
      log.warn("sd.cpp health check failed 3 times, attempting restart");
      _state.ready = false;
      _state.status = "error";
      _state.error = "Health check failed (3 consecutive failures)";
      // Stop health check and trigger auto-restart if possible (H9 fix)
      stopHealthCheck();
      if (_process && !_process.killed) {
        try {
          _process.kill("SIGTERM");
        } catch {
          /* ignore */
        }
      }
    }
  }, HEALTH_CHECK_INTERVAL_MS);
}

function stopHealthCheck(): void {
  if (_healthCheckTimer) {
    clearInterval(_healthCheckTimer);
    _healthCheckTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Generation API
// ---------------------------------------------------------------------------

/**
 * Generate an image via the local sd.cpp sidecar.
 * Returns base64-encoded image data.
 */
export async function generateImageLocal(params: {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
}): Promise<{ b64_json: string; seed: number } | null> {
  if (_state.status !== "running" || !_state.ready) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min timeout for generation

    const resp = await fetch(`http://127.0.0.1:${_state.port}/v1/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: params.prompt,
        negative_prompt: params.negativePrompt,
        size: `${params.width ?? 512}x${params.height ?? 512}`,
        n: 1,
        steps: params.steps,
        seed: params.seed,
        response_format: "b64_json",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "unknown");
      log.warn(`sd.cpp generation failed: ${resp.status} ${errText}`);
      return null;
    }

    const data = (await resp.json()) as {
      data?: Array<{ b64_json?: string; seed?: number }>;
    };

    const item = data.data?.[0];
    if (!item?.b64_json) return null;

    return {
      b64_json: item.b64_json,
      seed: item.seed ?? -1,
    };
  } catch (err) {
    log.warn(`sd.cpp generation error: ${(err as Error).message}`);
    return null;
  }
}
