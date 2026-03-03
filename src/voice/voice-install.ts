/**
 * Voice Tier Install — one-click installation pipeline.
 *
 * Orchestrates: hardware detection → tier classification → Python/model setup.
 * All downloads use multiple CN mirrors (ModelScope / hf-mirror / gh-proxy)
 * with automatic fallback.
 *
 * Reuses existing infrastructure:
 *   - getPipMirrors() from cn-mirrors.ts for PyPI mirror rotation
 *   - MirrorSelector from mirror-download-engine.ts for latency probing
 *   - IntegrityVerifier from mirror-download-engine.ts for SHA-256 checks
 *   - hasBinary() from shared/config-eval.ts for Python detection
 *   - runCommandWithTimeout() from process/exec.ts for subprocess execution
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";

import { getPipMirrors } from "../config/cn-mirrors.js";
import { IntegrityVerifier, MirrorSelector } from "../agents/skills/mirror-download-engine.js";
import { getProxyAwareFetch, detectProxyUrl } from "../infra/net/proxy-fetch.js";
import { runCommandWithTimeout } from "../process/exec.js";
import { hasBinary } from "../shared/config-eval.js";
import { CONFIG_DIR } from "../utils.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

import { getHardwareSnapshot } from "./hardware-detect.js";
import { classifyVoiceTier, getModelsForTier, tierRequiresPython } from "./voice-tier.js";
import { CPU_MODELS } from "./voice-models.js";
import type {
  VoiceInstallCallback,
  VoiceInstallProgress,
  VoiceModelFile,
  VoiceModelSpec,
  VoiceTierDecision,
  VoiceTierLevel,
} from "./types.js";

const log = createSubsystemLogger("voice/install");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export const VOICE_MODELS_DIR = path.join(CONFIG_DIR, "voice-models");
export const VOICE_ENV_DIR = path.join(CONFIG_DIR, "voice-env");
/** Standalone Python installation directory (auto-downloaded when system Python not found). */
const STANDALONE_PYTHON_DIR = path.join(CONFIG_DIR, "python");

/** Path to the bundled Python voice server script. */
function getVoiceServerScript(): string {
  // In dev: relative to src/; in dist: relative to dist/
  const candidates = [
    path.join(import.meta.dirname, "..", "..", "resources", "voice-server.py"),
    path.join(import.meta.dirname, "..", "resources", "voice-server.py"),
    path.join(process.cwd(), "resources", "voice-server.py"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0]!; // Return first candidate even if not found (error will surface later)
}

// ---------------------------------------------------------------------------
// Install Lock
// ---------------------------------------------------------------------------

let _installing = false;

// ---------------------------------------------------------------------------
// Progress Helper
// ---------------------------------------------------------------------------

function emitProgress(
  cb: VoiceInstallCallback | undefined,
  stage: VoiceInstallProgress["stage"],
  percent: number,
  message: string,
  extra?: Partial<VoiceInstallProgress>,
): void {
  cb?.({ stage, percent, message, ...extra });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Full one-click installation pipeline.
 *
 * 1. Detect hardware → classify tier
 * 2. GPU path: check Python → create venv → install PyTorch+deps → download model weights
 * 3. CPU path: download ONNX models (SenseVoice already handled, Kokoro is new)
 * 4. Verify integrity
 *
 * Returns the tier decision and any error.
 */
export async function installVoiceTier(
  onProgress?: VoiceInstallCallback,
  signal?: AbortSignal,
): Promise<{ ok: boolean; decision: VoiceTierDecision; error?: string }> {
  if (_installing) {
    return {
      ok: false,
      decision: classifyVoiceTier(getHardwareSnapshot()),
      error: "安装正在进行中，请勿重复操作",
    };
  }

  _installing = true;
  try {
    return await doInstall(onProgress, signal);
  } finally {
    _installing = false;
  }
}

async function doInstall(
  onProgress: VoiceInstallCallback | undefined,
  signal: AbortSignal | undefined,
): Promise<{ ok: boolean; decision: VoiceTierDecision; error?: string }> {
  // Step 1: Detect hardware
  emitProgress(onProgress, "detecting-hardware", 5, "正在检测硬件配置...");
  const hw = getHardwareSnapshot();
  const decision = classifyVoiceTier(hw);

  if (decision.tier === "disabled") {
    emitProgress(onProgress, "complete", 100, decision.reason);
    return { ok: true, decision };
  }

  if (signal?.aborted) return { ok: false, decision, error: "已取消" };

  // Step 2: Ensure models directory exists
  fs.mkdirSync(VOICE_MODELS_DIR, { recursive: true });

  // Step 3: Tier-specific install
  if (tierRequiresPython(decision.tier)) {
    // GPU path: Python + PyTorch + model weights
    const pythonResult = await installGpuTier(decision, onProgress, signal);
    if (!pythonResult.ok) {
      emitProgress(onProgress, "failed", 0, pythonResult.error ?? "安装失败", {
        error: pythonResult.error,
      });
      return { ok: false, decision, error: pythonResult.error };
    }
  } else {
    // CPU path: download ONNX models
    const cpuResult = await installCpuTier(decision, onProgress, signal);
    if (!cpuResult.ok) {
      emitProgress(onProgress, "failed", 0, cpuResult.error ?? "安装失败", {
        error: cpuResult.error,
      });
      return { ok: false, decision, error: cpuResult.error };
    }
  }

  emitProgress(onProgress, "complete", 100, "安装完成");
  return { ok: true, decision };
}

// ---------------------------------------------------------------------------
// GPU Tier Install (Python + PyTorch + Qwen3 models)
// ---------------------------------------------------------------------------

async function installGpuTier(
  decision: VoiceTierDecision,
  onProgress: VoiceInstallCallback | undefined,
  signal: AbortSignal | undefined,
): Promise<{ ok: boolean; error?: string }> {
  // 1. Check Python — auto-download standalone if not found
  emitProgress(onProgress, "checking-python", 10, "正在检测 Python 环境...");
  let python = findPython();
  if (!python.ok) {
    log.info("System Python not found, will download standalone Python automatically");
    emitProgress(onProgress, "checking-python", 10, "未检测到 Python，正在自动下载...", {
      detail: "将下载独立 Python 环境 (~25 MB)，无需手动安装",
    });
    const dlResult = await downloadStandalonePython(onProgress, signal);
    if (!dlResult.ok) {
      return { ok: false, error: dlResult.error };
    }
    // Re-check: findPython should now find the standalone Python
    python = findPython();
    if (!python.ok) {
      return { ok: false, error: `已下载 Python 但无法运行: ${python.error}` };
    }
  }
  log.info(`Found Python at ${python.path} (version ${python.version})`);

  if (signal?.aborted) return { ok: false, error: "已取消" };

  // 2. Create venv
  emitProgress(onProgress, "creating-venv", 15, "正在创建 Python 虚拟环境...");
  const venvResult = await ensureVenv(python.path);
  if (!venvResult.ok) {
    return { ok: false, error: venvResult.error };
  }

  if (signal?.aborted) return { ok: false, error: "已取消" };

  // 3. Install Python deps (torch + qwen-asr + fastapi)
  emitProgress(onProgress, "installing-deps", 20, "正在安装 PyTorch (CUDA)...", {
    detail: "这可能需要几分钟，取决于网络速度",
  });
  const depsResult = await installPythonDeps(venvResult.pipPath, onProgress);
  if (!depsResult.ok) {
    return { ok: false, error: depsResult.error };
  }

  if (signal?.aborted) return { ok: false, error: "已取消" };

  // 4. Download model weights — parallel strategy
  const modelsToDownload: VoiceModelSpec[] = [];
  if (decision.asrModel?.backend === "python-sidecar") modelsToDownload.push(decision.asrModel);
  if (decision.ttsModel?.backend === "python-sidecar") modelsToDownload.push(decision.ttsModel);

  emitProgress(
    onProgress,
    "downloading-models",
    50,
    `正在下载 ${modelsToDownload.map((m) => m.displayName).join(" + ")}...`,
  );

  const dlResult = await downloadModelsParallel(modelsToDownload, onProgress, signal);
  if (!dlResult.ok) return { ok: false, error: dlResult.error };

  return { ok: true };
}

// ---------------------------------------------------------------------------
// CPU Tier Install (download ONNX models)
// ---------------------------------------------------------------------------

async function installCpuTier(
  decision: VoiceTierDecision,
  onProgress: VoiceInstallCallback | undefined,
  signal: AbortSignal | undefined,
): Promise<{ ok: boolean; error?: string }> {
  // Step 0: Ensure sherpa-onnx-node native addon is installed
  emitProgress(onProgress, "installing-deps", 10, "正在检查 sherpa-onnx-node...");
  const sherpaResult = await ensureSherpaOnnxNode(onProgress);
  if (!sherpaResult.ok) {
    return { ok: false, error: sherpaResult.error };
  }

  if (signal?.aborted) return { ok: false, error: "已取消" };

  const modelsToDownload: VoiceModelSpec[] = [];

  // SenseVoice: check if already installed (handled by existing skills system)
  if (decision.asrModel && decision.asrModel.id === "sensevoice-small") {
    const asrDir = path.join(VOICE_MODELS_DIR, decision.asrModel.modelDirName);
    // Also check the legacy ASR models dir
    const legacyDir = path.join(CONFIG_DIR, "tools", "sherpa-onnx-asr", "models");
    const legacyInstalled =
      fs.existsSync(legacyDir) && hasRequiredFiles(legacyDir, decision.asrModel);
    if (!legacyInstalled && !hasRequiredFiles(asrDir, decision.asrModel)) {
      modelsToDownload.push(decision.asrModel);
    }
  }

  // Kokoro: check if already installed
  if (decision.ttsModel && decision.ttsModel.id === "kokoro-82m") {
    const ttsDir = path.join(VOICE_MODELS_DIR, decision.ttsModel.modelDirName);
    if (!hasRequiredFiles(ttsDir, decision.ttsModel)) {
      modelsToDownload.push(decision.ttsModel);
    }
  }

  // KWS: always install alongside CPU voice models (tiny, ~5.3 MB)
  {
    const kwsModel = CPU_MODELS.kwsZipformer;
    const kwsDir = path.join(VOICE_MODELS_DIR, kwsModel.modelDirName);
    if (!hasRequiredFiles(kwsDir, kwsModel)) {
      modelsToDownload.push(kwsModel);
    }
  }

  if (modelsToDownload.length === 0) {
    emitProgress(onProgress, "complete", 100, "模型已安装，无需下载");
    return { ok: true };
  }

  emitProgress(
    onProgress,
    "downloading-models",
    20,
    `正在下载 ${modelsToDownload.map((m) => m.displayName).join(" + ")}...`,
  );

  const dlResult = await downloadModelsParallel(modelsToDownload, onProgress, signal);
  if (!dlResult.ok) return { ok: false, error: dlResult.error };

  return { ok: true };
}

// ---------------------------------------------------------------------------
// sherpa-onnx-node Installation
// ---------------------------------------------------------------------------

/**
 * Check if sherpa-onnx-node is available, install it if not.
 *
 * The native addon is installed via npm into the project's node_modules.
 * Uses CN npm mirror (npmmirror.com) for faster download in China.
 */
async function ensureSherpaOnnxNode(
  onProgress: VoiceInstallCallback | undefined,
): Promise<{ ok: boolean; error?: string }> {
  // Check if already loadable
  try {
    require("sherpa-onnx-node");
    log.info("sherpa-onnx-node already installed");
    return { ok: true };
  } catch {
    // Not installed, proceed with installation
  }

  emitProgress(onProgress, "installing-deps", 12, "正在安装 sherpa-onnx-node 语音引擎...", {
    detail: "本地语音识别/合成所需的原生模块 (~50 MB)",
  });

  // Find npm
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const proxyUrl = detectProxyUrl();
  const proxyArgs = proxyUrl ? ["--proxy", proxyUrl, "--https-proxy", proxyUrl] : [];

  // CN npm mirror for faster download
  const registryArgs = ["--registry", "https://registry.npmmirror.com"];

  try {
    const result = await runCommandWithTimeout(
      [npmCmd, "install", "sherpa-onnx-node", "--no-save", ...registryArgs, ...proxyArgs],
      {
        timeoutMs: 300_000, // 5 min — binary addon download
        // Don't spread the full process.env — it triggers env validation on Windows
        // where variables like CommonProgramFiles(x86) may fail security checks.
        // Omitting env inherits process.env; only override NODE_OPTIONS to empty.
        env: { NODE_OPTIONS: "" },
      },
    );

    if (result.code === 0) {
      log.info("sherpa-onnx-node installed successfully");
      // Verify it loads
      try {
        require("sherpa-onnx-node");
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: `sherpa-onnx-node 安装成功但加载失败: ${(err as Error).message}`,
        };
      }
    }

    return { ok: false, error: `sherpa-onnx-node 安装失败: ${result.stderr.slice(0, 500)}` };
  } catch (err) {
    return { ok: false, error: `sherpa-onnx-node 安装失败: ${(err as Error).message}` };
  }
}

// ---------------------------------------------------------------------------
// Python Detection
// ---------------------------------------------------------------------------

function findPython(): { ok: true; path: string; version: string } | { ok: false; error: string } {
  const candidates =
    process.platform === "win32" ? ["python", "python3", "py"] : ["python3", "python"];

  // Check our standalone Python installation first (highest priority)
  if (process.platform === "win32") {
    candidates.unshift(path.join(STANDALONE_PYTHON_DIR, "python.exe"));
  } else {
    candidates.unshift(path.join(STANDALONE_PYTHON_DIR, "bin", "python3"));
  }

  // On Windows, also try common absolute paths that may not be in the
  // gateway process's PATH (e.g. when launched from Tauri desktop).
  if (process.platform === "win32") {
    const home = process.env.LOCALAPPDATA ?? process.env.USERPROFILE ?? "";
    if (home) {
      // Standard python.org installer paths
      for (const ver of ["313", "312", "311", "310"]) {
        candidates.push(path.join(home, "Programs", "Python", `Python${ver}`, "python.exe"));
      }
      // Microsoft Store Python
      candidates.push(path.join(home, "Microsoft", "WindowsApps", "python3.exe"));
    }
    // System-wide installs
    for (const ver of ["313", "312", "311", "310"]) {
      candidates.push(`C:\\Python${ver}\\python.exe`);
    }
  }

  for (const cmd of candidates) {
    // For absolute paths, check existence directly; for bare names, use hasBinary
    const isAbsPath = path.isAbsolute(cmd);
    if (isAbsPath) {
      if (!fs.existsSync(cmd)) continue;
    } else {
      if (!hasBinary(cmd)) continue;
    }

    try {
      const versionOutput = execFileSync(cmd, ["--version"], {
        timeout: 5000,
        encoding: "utf-8",
        stdio: "pipe",
        windowsHide: true,
      }).trim();

      // Parse "Python 3.12.1"
      const match = versionOutput.match(/Python (\d+)\.(\d+)/);
      if (!match) continue;

      const major = Number.parseInt(match[1]!, 10);
      const minor = Number.parseInt(match[2]!, 10);

      if (major < 3 || (major === 3 && minor < 10)) {
        continue; // Need Python >= 3.10
      }

      // Resolve absolute path
      const absPath = execFileSync(cmd, ["-c", "import sys; print(sys.executable)"], {
        timeout: 5000,
        encoding: "utf-8",
        stdio: "pipe",
        windowsHide: true,
      }).trim();

      return { ok: true, path: absPath, version: `${major}.${minor}` };
    } catch {
      continue;
    }
  }

  return {
    ok: false,
    error:
      "未检测到 Python 3.10+。\n" +
      "  macOS: brew install python@3.12\n" +
      "  Linux: sudo apt install python3.12\n" +
      "  Windows: 通常会自动下载，如失败请手动安装 https://www.python.org/downloads/",
  };
}

// ---------------------------------------------------------------------------
// Standalone Python Auto-Download (Windows)
// ---------------------------------------------------------------------------

/**
 * Download a standalone CPython build (python-build-standalone from
 * indygreg/python-build-standalone) and extract it to STANDALONE_PYTHON_DIR.
 *
 * The standalone build is a complete Python with pip and venv, no installer
 * required. On Windows we use the install_only variant (~25 MB compressed).
 *
 * Uses CN GitHub mirrors for download acceleration in mainland China.
 */
async function downloadStandalonePython(
  onProgress: VoiceInstallCallback | undefined,
  signal: AbortSignal | undefined,
): Promise<{ ok: boolean; error?: string }> {
  if (process.platform !== "win32") {
    return { ok: false, error: "自动下载 Python 仅支持 Windows，请手动安装 Python 3.12" };
  }

  // Already downloaded?
  const pythonExe = path.join(STANDALONE_PYTHON_DIR, "python.exe");
  if (fs.existsSync(pythonExe)) {
    return { ok: true };
  }

  const PYTHON_VERSION = "3.12.8";
  const RELEASE_TAG = "20241219";
  const archSuffix = os.arch() === "arm64" ? "aarch64" : "x86_64";

  // python-build-standalone provides install_only tarballs (no debug, smaller)
  const filename = `cpython-${PYTHON_VERSION}+${RELEASE_TAG}-${archSuffix}-pc-windows-msvc-install_only.tar.gz`;
  const baseUrl = `https://github.com/indygreg/python-build-standalone/releases/download/${RELEASE_TAG}/${filename}`;

  // CN mirror cascade for GitHub releases
  const mirrors = [
    { label: "gh-proxy", url: `https://gh-proxy.com/${baseUrl}` },
    { label: "ghfast", url: `https://ghfast.top/${baseUrl}` },
    { label: "kkgithub", url: baseUrl.replace("github.com", "kkgithub.com") },
    { label: "GitHub", url: baseUrl },
  ];

  const fetcher = getProxyAwareFetch();

  for (let attempt = 0; attempt < mirrors.length; attempt++) {
    if (signal?.aborted) return { ok: false, error: "已取消" };

    const mirror = mirrors[attempt]!;
    emitProgress(
      onProgress,
      "checking-python",
      10,
      `正在从${mirror.label}下载 Python ${PYTHON_VERSION}...`,
      {
        detail: "独立 Python 环境 (~25 MB)，解压即用",
        mirrorUsed: mirror.label,
      },
    );

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300_000); // 5 min
      const onAbort = () => controller.abort();
      signal?.addEventListener("abort", onAbort, { once: true });

      try {
        const response = await fetcher(mirror.url, {
          signal: controller.signal,
          headers: { "User-Agent": "OpenClawCN/1.0" },
          redirect: "follow",
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error("Response has no body");
        }

        // Download to temp file first, then extract
        const tmpTarGz = path.join(os.tmpdir(), `openclawcn-python-${Date.now()}.tar.gz`);
        const fileStream = fs.createWriteStream(tmpTarGz);
        // @ts-expect-error -- Node.js ReadableStream compatibility
        await pipeline(response.body, fileStream);

        log.info(
          `Downloaded Python archive from ${mirror.label} (${fs.statSync(tmpTarGz).size} bytes)`,
        );

        // Extract .tar.gz
        emitProgress(onProgress, "checking-python", 12, "正在解压 Python...");

        fs.mkdirSync(STANDALONE_PYTHON_DIR, { recursive: true });

        // Use tar to extract (available on Windows 10+ natively)
        const extractResult = await runCommandWithTimeout(
          ["tar", "xzf", tmpTarGz, "--strip-components=1", "-C", STANDALONE_PYTHON_DIR],
          { timeoutMs: 120_000 },
        );

        // Clean up temp file
        try {
          fs.unlinkSync(tmpTarGz);
        } catch {
          /* ignore */
        }

        if (extractResult.code !== 0) {
          // tar may not be available — try PowerShell fallback
          log.warn(`tar extraction failed: ${extractResult.stderr}, trying PowerShell...`);
          const psResult = await extractTarGzWithPowerShell(tmpTarGz, STANDALONE_PYTHON_DIR);
          if (!psResult.ok) {
            return { ok: false, error: `解压 Python 失败: ${psResult.error}` };
          }
        }

        // Verify python.exe exists
        if (fs.existsSync(pythonExe)) {
          log.info(`Standalone Python installed at ${STANDALONE_PYTHON_DIR}`);

          // Ensure pip is bootstrapped
          emitProgress(onProgress, "checking-python", 13, "正在初始化 pip...");
          try {
            await runCommandWithTimeout([pythonExe, "-m", "ensurepip", "--upgrade"], {
              timeoutMs: 60_000,
            });
          } catch {
            // ensurepip may already be done
          }

          return { ok: true };
        }

        // python.exe not found — the archive structure may have nested dirs
        // python-build-standalone extracts to python/python.exe
        const nestedExe = path.join(STANDALONE_PYTHON_DIR, "python", "python.exe");
        if (fs.existsSync(nestedExe)) {
          // Move contents from python/ up one level
          const nestedDir = path.join(STANDALONE_PYTHON_DIR, "python");
          const tmpRename = STANDALONE_PYTHON_DIR + "_tmp";
          fs.renameSync(nestedDir, tmpRename);
          fs.rmSync(STANDALONE_PYTHON_DIR, { recursive: true, force: true });
          fs.renameSync(tmpRename, STANDALONE_PYTHON_DIR);
          log.info(
            `Standalone Python installed at ${STANDALONE_PYTHON_DIR} (moved from nested dir)`,
          );

          emitProgress(onProgress, "checking-python", 13, "正在初始化 pip...");
          try {
            await runCommandWithTimeout(
              [path.join(STANDALONE_PYTHON_DIR, "python.exe"), "-m", "ensurepip", "--upgrade"],
              { timeoutMs: 60_000 },
            );
          } catch {
            /* already bootstrapped */
          }

          return { ok: true };
        }

        return { ok: false, error: "解压完成但未找到 python.exe" };
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", onAbort);
      }
    } catch (err) {
      const errMsg = (err as Error).message;
      log.warn(`Python download from ${mirror.label} failed: ${errMsg}`);
      if (attempt === mirrors.length - 1) {
        return { ok: false, error: `下载 Python 失败 (已尝试所有镜像): ${errMsg}` };
      }
    }
  }

  return { ok: false, error: "所有镜像下载 Python 均失败" };
}

/**
 * Fallback: extract .tar.gz using PowerShell (for Windows without tar).
 */
async function extractTarGzWithPowerShell(
  tarGzPath: string,
  destDir: string,
): Promise<{ ok: boolean; error?: string }> {
  // PowerShell: decompress gzip, then extract tar
  // Step 1: gunzip -> .tar
  const tarPath = tarGzPath.replace(/\.gz$/, "");
  try {
    const gzStream = fs.createReadStream(tarGzPath);
    const gunzip = createGunzip();
    const tarStream = fs.createWriteStream(tarPath);
    await pipeline(gzStream, gunzip, tarStream);
  } catch (err) {
    return { ok: false, error: `gunzip failed: ${(err as Error).message}` };
  }

  // Step 2: extract tar using tar (with just the .tar file, no gz)
  const result = await runCommandWithTimeout(
    ["tar", "xf", tarPath, "--strip-components=1", "-C", destDir],
    { timeoutMs: 120_000 },
  );

  try {
    fs.unlinkSync(tarPath);
  } catch {
    /* ignore */
  }
  try {
    fs.unlinkSync(tarGzPath);
  } catch {
    /* ignore */
  }

  if (result.code !== 0) {
    return { ok: false, error: result.stderr.slice(0, 500) };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Python Venv
// ---------------------------------------------------------------------------

async function ensureVenv(
  pythonPath: string,
): Promise<{ ok: true; venvPython: string; pipPath: string } | { ok: false; error: string }> {
  const venvPython =
    process.platform === "win32"
      ? path.join(VOICE_ENV_DIR, "Scripts", "python.exe")
      : path.join(VOICE_ENV_DIR, "bin", "python");

  const pipPath =
    process.platform === "win32"
      ? path.join(VOICE_ENV_DIR, "Scripts", "pip.exe")
      : path.join(VOICE_ENV_DIR, "bin", "pip");

  // Check if venv already exists and is valid
  if (fs.existsSync(venvPython)) {
    try {
      execFileSync(venvPython, ["--version"], {
        timeout: 5000,
        stdio: "pipe",
        windowsHide: true,
      });
      return { ok: true, venvPython, pipPath };
    } catch {
      // Venv exists but broken, recreate
      log.warn("Existing voice venv is broken, recreating...");
    }
  }

  // Create venv
  try {
    fs.mkdirSync(path.dirname(VOICE_ENV_DIR), { recursive: true });
    const result = await runCommandWithTimeout([pythonPath, "-m", "venv", VOICE_ENV_DIR], {
      timeoutMs: 60_000,
    });
    if (result.code !== 0) {
      return { ok: false, error: `创建 Python 虚拟环境失败: ${result.stderr}` };
    }
    return { ok: true, venvPython, pipPath };
  } catch (err) {
    return { ok: false, error: `创建 Python 虚拟环境失败: ${(err as Error).message}` };
  }
}

// ---------------------------------------------------------------------------
// Python Dependencies
// ---------------------------------------------------------------------------

/**
 * Install Python packages into the venv.
 * Uses 3-mirror rotation for PyPI packages.
 * PyTorch CUDA wheels use CN mirrors (Alibaba / official) with fallback.
 */
async function installPythonDeps(
  pipPath: string,
  onProgress: VoiceInstallCallback | undefined,
): Promise<{ ok: boolean; error?: string }> {
  // Build proxy args for pip if HTTP_PROXY / HTTPS_PROXY is set
  const proxyUrl = detectProxyUrl();
  const proxyArgs = proxyUrl ? ["--proxy", proxyUrl] : [];
  if (proxyUrl) {
    log.info(`Using proxy for pip install: ${proxyUrl}`);
  }

  // Step 1: Install PyTorch with CUDA support using CN mirror rotation
  const torchMirrors = [
    { label: "阿里云", url: "https://mirrors.aliyun.com/pytorch-wheels/cu121" },
    { label: "南大", url: "https://mirrors.nju.edu.cn/pytorch/whl/cu121" },
    { label: "上海交大", url: "https://mirror.sjtu.edu.cn/pytorch-wheels/cu121" },
    { label: "官方", url: "https://download.pytorch.org/whl/cu121" },
  ];

  for (let attempt = 0; attempt < torchMirrors.length; attempt++) {
    const mirror = torchMirrors[attempt]!;
    emitProgress(
      onProgress,
      "installing-deps",
      25 + attempt * 5,
      `正在安装 PyTorch (CUDA 12.1)...`,
      {
        detail: `从${mirror.label}镜像下载，文件约 2.5 GB`,
        mirrorUsed: mirror.label,
      },
    );

    try {
      const torchResult = await runCommandWithTimeout(
        [pipPath, "install", "torch", "torchaudio", "--index-url", mirror.url, ...proxyArgs],
        {
          timeoutMs: 3_600_000, // 60 min for large torch wheel (~2.5GB) on slow CN networks
          env: {
            ...process.env,
            NODE_OPTIONS: undefined,
            HF_ENDPOINT: "https://hf-mirror.com",
            HF_HUB_OFFLINE: "1",
          },
        },
      );
      if (torchResult.code === 0) {
        log.info(`PyTorch installed successfully via ${mirror.label}`);
        break;
      }

      // Check if network error (worth retrying next mirror)
      const stderr = torchResult.stderr.toLowerCase();
      const isNetworkError = [
        "enotfound",
        "etimedout",
        "econnrefused",
        "ssl",
        "connection",
        "timeout",
        "443",
        "404",
      ].some((keyword) => stderr.includes(keyword));

      if (!isNetworkError || attempt === torchMirrors.length - 1) {
        return { ok: false, error: `安装 PyTorch 失败: ${torchResult.stderr.slice(0, 500)}` };
      }
      log.warn(`PyTorch mirror ${mirror.label} failed, trying next...`);
    } catch (err) {
      if (attempt === torchMirrors.length - 1) {
        return { ok: false, error: `安装 PyTorch 失败: ${(err as Error).message}` };
      }
      log.warn(`PyTorch mirror ${mirror.label} error: ${(err as Error).message}`);
    }
  }

  // Step 2: Install qwen-asr + qwen-tts + fastapi + uvicorn with CN mirror rotation
  emitProgress(onProgress, "installing-deps", 40, "正在安装 qwen-asr、qwen-tts、FastAPI...", {
    detail: "使用国内镜像加速",
  });

  const pipMirrors = getPipMirrors();
  const packages = ["qwen-asr", "qwen-tts", "fastapi", "uvicorn[standard]"];

  for (let attempt = 0; attempt < pipMirrors.length; attempt++) {
    const mirror = pipMirrors[attempt]!;
    const mirrorLabel = attempt === 0 ? "清华" : attempt === 1 ? "阿里云" : "中科大";

    emitProgress(
      onProgress,
      "installing-deps",
      42 + attempt * 2,
      `正在安装依赖... (镜像: ${mirrorLabel})`,
      {
        mirrorUsed: mirrorLabel,
      },
    );

    try {
      const result = await runCommandWithTimeout(
        [
          pipPath,
          "install",
          ...packages,
          "-i",
          mirror,
          "--trusted-host",
          new URL(mirror).hostname,
          ...proxyArgs,
        ],
        {
          timeoutMs: 600_000, // 10 min
          env: {
            ...process.env,
            NODE_OPTIONS: undefined,
            HF_ENDPOINT: "https://hf-mirror.com",
            HF_HUB_OFFLINE: "1",
          },
        },
      );
      if (result.code === 0) {
        log.info(`Python deps installed successfully via ${mirrorLabel}`);
        return { ok: true };
      }

      // Check if it's a network error (worth retrying with next mirror)
      const stderr = result.stderr.toLowerCase();
      const isNetworkError = [
        "enotfound",
        "etimedout",
        "econnrefused",
        "ssl",
        "connection",
        "timeout",
      ].some((keyword) => stderr.includes(keyword));

      if (!isNetworkError) {
        // Non-network error, don't retry
        return { ok: false, error: `安装依赖失败: ${result.stderr.slice(0, 500)}` };
      }

      log.warn(`Mirror ${mirrorLabel} failed, trying next...`);
    } catch (err) {
      log.warn(`Mirror ${mirrorLabel} error: ${(err as Error).message}`);
    }
  }

  return { ok: false, error: "所有镜像均安装失败，请检查网络连接" };
}

// ---------------------------------------------------------------------------
// Model File Download
// ---------------------------------------------------------------------------

/** Size threshold: files larger than this download serially; smaller ones in parallel. */
const PARALLEL_SIZE_THRESHOLD = 10 * 1024 * 1024; // 10 MB

/**
 * Download files across one or more models with parallel strategy:
 *   1. Probe mirrors once (shared across all files).
 *   2. Large files (>10 MB) download serially — full bandwidth per file.
 *   3. Small config files (<10 MB) download all at once in parallel.
 *
 * For GPU tier (ASR 1.88GB + TTS 2.4GB):
 *   Serial: 1.88 + 0.68 + 1.83 GB @ 25 MB/s ≈ 175s
 *   With this: same for large, but all ~15 config files download in 1 round ≈ 1s
 *
 * For CPU tier (SenseVoice 228MB + Kokoro 86MB):
 *   All files >10 MB → serial, tiny config files → parallel.
 */
async function downloadModelsParallel(
  models: VoiceModelSpec[],
  onProgress: VoiceInstallCallback | undefined,
  signal: AbortSignal | undefined,
): Promise<{ ok: boolean; error?: string }> {
  // Ensure all model directories exist
  for (const model of models) {
    fs.mkdirSync(path.join(VOICE_MODELS_DIR, model.modelDirName), { recursive: true });
  }

  // Probe mirrors once using any model's first file sources
  let bestMirrorUrl: string | undefined;
  const firstFile = models[0]?.files[0];
  if (firstFile && firstFile.sources.length > 0) {
    const selector = new MirrorSelector(firstFile.sources.map((s) => s.url));
    try {
      await selector.probe();
      bestMirrorUrl = selector.getBest();
    } catch {
      /* use default order */
    }
  }

  // Collect and tag all files with their model dir
  type TaggedFile = { file: VoiceModelFile; modelDir: string };
  const largeFiles: TaggedFile[] = [];
  const smallFiles: TaggedFile[] = [];

  for (const model of models) {
    const modelDir = path.join(VOICE_MODELS_DIR, model.modelDirName);
    for (const file of model.files) {
      const tagged = { file, modelDir };
      if (file.sizeBytes >= PARALLEL_SIZE_THRESHOLD) {
        largeFiles.push(tagged);
      } else {
        smallFiles.push(tagged);
      }
    }
  }

  log.info(
    `Download plan: ${largeFiles.length} large files (serial) + ${smallFiles.length} small files (parallel)`,
  );

  // Phase 1: Large files sequentially — full bandwidth each
  for (const { file, modelDir } of largeFiles) {
    if (signal?.aborted) return { ok: false, error: "已取消" };
    const result = await downloadOneFile(file, modelDir, bestMirrorUrl, onProgress, signal);
    if (!result.ok) return result;
  }

  // Phase 2: All small config files in parallel — typically <1s total
  if (smallFiles.length > 0) {
    if (signal?.aborted) return { ok: false, error: "已取消" };
    emitProgress(
      onProgress,
      "downloading-models",
      0,
      `正在并行下载配置文件 (${smallFiles.length} 个)...`,
    );
    const smallResults = await Promise.all(
      smallFiles.map(({ file, modelDir }) =>
        downloadOneFile(file, modelDir, bestMirrorUrl, undefined, signal),
      ),
    );
    for (const r of smallResults) {
      if (!r.ok) return r;
    }
  }

  return { ok: true };
}

/**
 * Compute a dynamic timeout based on file size and a conservative bandwidth estimate.
 * Minimum 60s, scaled at 1 MB/s (very conservative for slow CN networks).
 * Adds 30s buffer for connection setup / CDN redirects.
 */
function dynamicTimeout(sizeBytes: number): number {
  const MIN_TIMEOUT_MS = 60_000;
  const BANDWIDTH_BYTES_PER_SEC = 1_000_000; // 1 MB/s conservative floor
  const CONNECTION_OVERHEAD_MS = 30_000;
  const estimated = (sizeBytes / BANDWIDTH_BYTES_PER_SEC) * 1000 + CONNECTION_OVERHEAD_MS;
  return Math.max(MIN_TIMEOUT_MS, Math.ceil(estimated));
}

/** Download a single file with skip-if-exists and integrity check. */
async function downloadOneFile(
  file: VoiceModelFile,
  modelDir: string,
  bestMirrorUrl: string | undefined,
  onProgress: VoiceInstallCallback | undefined,
  signal: AbortSignal | undefined,
): Promise<{ ok: boolean; error?: string }> {
  const destPath = path.join(modelDir, file.relativePath);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });

  // Skip if file already exists and looks complete
  if (fs.existsSync(destPath)) {
    const stat = fs.statSync(destPath);
    if (stat.size >= file.sizeBytes * 0.95) {
      log.info(`Skipping ${file.relativePath} (already exists, ${stat.size} bytes)`);
      return { ok: true };
    }
    // Keep partial file for resume attempt (don't delete)
  }

  emitProgress(onProgress, "downloading-models", 0, `正在下载 ${file.relativePath}...`, {
    detail: `${Math.round(file.sizeBytes / (1024 * 1024))} MB`,
  });

  const dlResult = await downloadFileWithMirrors(file, destPath, bestMirrorUrl, onProgress, signal);
  if (!dlResult.ok) {
    return { ok: false, error: `下载 ${file.relativePath} 失败: ${dlResult.error}` };
  }

  // Verify integrity if SHA-256 is provided
  const sha256 = file.sources.find((s) => s.sha256)?.sha256;
  if (sha256) {
    const valid = await IntegrityVerifier.verify(destPath, sha256);
    if (!valid) {
      fs.unlinkSync(destPath);
      return { ok: false, error: `${file.relativePath} 校验失败，文件可能已损坏` };
    }
  }

  return { ok: true };
}

/**
 * Download a single file, trying each mirror source in order.
 *
 * Features:
 *   - Proxy-aware: uses HTTP_PROXY / HTTPS_PROXY env vars via undici ProxyAgent
 *   - Resume: sends Range header if partial file exists, appends to it
 *   - Dynamic timeout: scales with file size (1 MB/s floor + 30s overhead)
 *
 * @param bestMirrorUrl Pre-probed best mirror URL (optional, avoids per-file probing).
 */
async function downloadFileWithMirrors(
  file: VoiceModelFile,
  destPath: string,
  bestMirrorUrl: string | undefined,
  onProgress: VoiceInstallCallback | undefined,
  signal: AbortSignal | undefined,
): Promise<{ ok: boolean; error?: string }> {
  const errors: string[] = [];
  const fetcher = getProxyAwareFetch();
  const proxyUrl = detectProxyUrl();
  if (proxyUrl) {
    log.info(`Using proxy for download: ${proxyUrl}`);
  }

  // Build ordered list: best mirror first (if probed), then rest in default order
  const orderedSources = [...file.sources];
  if (bestMirrorUrl) {
    const bestHost = new URL(bestMirrorUrl).hostname;
    const bestIdx = orderedSources.findIndex((s) => new URL(s.url).hostname === bestHost);
    if (bestIdx > 0) {
      const [best] = orderedSources.splice(bestIdx, 1);
      orderedSources.unshift(best!);
    }
  }

  const timeoutMs = dynamicTimeout(file.sizeBytes);

  // Try each mirror
  for (let attempt = 0; attempt < orderedSources.length; attempt++) {
    if (signal?.aborted) return { ok: false, error: "已取消" };

    const source = orderedSources[attempt]!;

    // Check for existing partial file for resume
    let existingSize = 0;
    try {
      const stat = fs.statSync(destPath);
      existingSize = stat.size;
    } catch {
      /* no partial file */
    }

    const isResume = existingSize > 0 && existingSize < file.sizeBytes * 0.95;

    emitProgress(
      onProgress,
      "downloading-models",
      0,
      isResume
        ? `正在从 ${source.label} 续传 (已有 ${Math.round(existingSize / (1024 * 1024))}MB)...`
        : `正在从 ${source.label} 下载...`,
      { mirrorUsed: source.label },
    );

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      // Link signal abort to our controller
      const onAbort = () => controller.abort();
      signal?.addEventListener("abort", onAbort, { once: true });

      try {
        const headers: Record<string, string> = { "User-Agent": "OpenClawCN/1.0" };
        if (isResume) {
          headers["Range"] = `bytes=${existingSize}-`;
        }

        const response = await fetcher(source.url, {
          signal: controller.signal,
          headers,
        });

        // Handle resume response
        if (isResume && response.status === 206) {
          // Server supports Range — append to existing file
          if (!response.body) throw new Error("Response has no body");
          const fileStream = fs.createWriteStream(destPath, { flags: "a" });
          // @ts-expect-error -- Node.js ReadableStream compatibility
          await pipeline(response.body, fileStream);
          log.info(`Resumed + completed ${file.relativePath} from ${source.label}`);
          return { ok: true };
        }

        if (isResume && response.status === 200) {
          // Server doesn't support Range — restart from scratch
          log.info(`Server doesn't support resume, downloading full file from ${source.label}`);
          existingSize = 0;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error("Response has no body");
        }

        // Stream to file (overwrite for full download)
        const fileStream = fs.createWriteStream(destPath);
        // @ts-expect-error -- Node.js ReadableStream compatibility
        await pipeline(response.body, fileStream);

        log.info(`Downloaded ${file.relativePath} from ${source.label}`);
        return { ok: true };
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", onAbort);
      }
    } catch (err) {
      const errMsg = (err as Error).message;
      errors.push(`${source.label}: ${errMsg}`);
      log.warn(`Download from ${source.label} failed: ${errMsg}`);

      // Don't delete partial file — it can be resumed on next attempt/mirror
    }
  }

  return { ok: false, error: errors.join("; ") };
}

// ---------------------------------------------------------------------------
// Installation Status Check
// ---------------------------------------------------------------------------

/**
 * Check if a model's required files are all present in a directory.
 */
function hasRequiredFiles(dir: string, model: VoiceModelSpec): boolean {
  if (!fs.existsSync(dir)) return false;
  for (const file of model.files) {
    const filePath = path.join(dir, file.relativePath);
    if (!fs.existsSync(filePath)) return false;
    // Check file is not empty / not a stub
    try {
      const stat = fs.statSync(filePath);
      if (stat.size < file.sizeBytes * 0.5) return false; // Less than 50% of expected size
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Check if a tier's models are already installed.
 */
export function isVoiceTierInstalled(tier: VoiceTierLevel): boolean {
  const { asr, tts } = getModelsForTier(tier);

  if (asr && asr.files.length > 0) {
    if (asr.id === "sensevoice-small") {
      // SenseVoice may be in either the voice-models dir or the legacy ASR dir
      const voiceDir = path.join(VOICE_MODELS_DIR, asr.modelDirName);
      const legacyDir = path.join(CONFIG_DIR, "tools", "sherpa-onnx-asr", "models");
      const inVoice = hasRequiredFiles(voiceDir, asr);
      const inLegacy =
        fs.existsSync(legacyDir) &&
        fs.readdirSync(legacyDir).some((entry) => {
          const entryDir = path.join(legacyDir, entry);
          return (
            entry.includes("sense-voice") &&
            fs.existsSync(path.join(entryDir, "model.int8.onnx")) &&
            fs.existsSync(path.join(entryDir, "tokens.txt"))
          );
        });
      if (!inVoice && !inLegacy) return false;
    } else {
      const dir = path.join(VOICE_MODELS_DIR, asr.modelDirName);
      if (!hasRequiredFiles(dir, asr)) return false;
    }
  }

  if (tts && tts.files.length > 0) {
    const dir = path.join(VOICE_MODELS_DIR, tts.modelDirName);
    if (!hasRequiredFiles(dir, tts)) return false;
  }

  return true;
}

/**
 * Get the installation state of each model in a tier.
 */
export function getModelInstallStates(tier: VoiceTierLevel): {
  asr: { model: VoiceModelSpec | null; installed: boolean };
  tts: { model: VoiceModelSpec | null; installed: boolean };
} {
  const { asr, tts } = getModelsForTier(tier);

  return {
    asr: {
      model: asr,
      installed: asr ? asr.files.length === 0 || isModelInstalled(asr) : false,
    },
    tts: {
      model: tts,
      installed: tts ? tts.files.length === 0 || isModelInstalled(tts) : false,
    },
  };
}

function isModelInstalled(model: VoiceModelSpec): boolean {
  if (model.files.length === 0) return true; // Edge TTS, no files needed
  const dir = path.join(VOICE_MODELS_DIR, model.modelDirName);
  return hasRequiredFiles(dir, model);
}

// ---------------------------------------------------------------------------
// Single Model Install (for local-engine UI — install one model at a time)
// ---------------------------------------------------------------------------

/**
 * Install a single voice model by ID.
 *
 * Handles environment setup (Python venv for GPU models, sherpa-onnx-node for
 * CPU models) then downloads only the specified model's weights.
 *
 * Used by the local-engine UI when the user clicks [安装] on an individual model.
 */
export async function installSingleVoiceModel(
  modelId: string,
  onProgress?: VoiceInstallCallback,
  signal?: AbortSignal,
): Promise<{ ok: boolean; error?: string }> {
  const { ALL_MODELS } = await import("./voice-models.js");
  const model = ALL_MODELS[modelId];
  if (!model) {
    return { ok: false, error: `未知的语音模型: ${modelId}` };
  }

  // Edge TTS has no files to install
  if (model.files.length === 0) {
    emitProgress(onProgress, "complete", 100, `${model.displayName} 无需安装`);
    return { ok: true };
  }

  // Already installed?
  const dir = path.join(VOICE_MODELS_DIR, model.modelDirName);
  if (hasRequiredFiles(dir, model)) {
    emitProgress(onProgress, "complete", 100, `${model.displayName} 已安装`);
    return { ok: true };
  }

  if (_installing) {
    return { ok: false, error: "有其他模型正在安装中，请稍后重试" };
  }
  _installing = true;

  try {
    fs.mkdirSync(VOICE_MODELS_DIR, { recursive: true });

    // Environment setup depends on backend
    if (model.backend === "python-sidecar") {
      // GPU model: need Python + venv + PyTorch
      emitProgress(onProgress, "checking-python", 5, "正在检测 Python 环境...");
      const python = findPython();
      if (!python.ok) return { ok: false, error: python.error };

      if (signal?.aborted) return { ok: false, error: "已取消" };

      emitProgress(onProgress, "creating-venv", 10, "正在检查虚拟环境...");
      const venvResult = await ensureVenv(python.path);
      if (!venvResult.ok) return { ok: false, error: venvResult.error };

      if (signal?.aborted) return { ok: false, error: "已取消" };

      emitProgress(onProgress, "installing-deps", 15, "正在检查 PyTorch 依赖...");
      const depsResult = await installPythonDeps(venvResult.pipPath, onProgress);
      if (!depsResult.ok) return { ok: false, error: depsResult.error };

      if (signal?.aborted) return { ok: false, error: "已取消" };
    } else if (model.backend === "sherpa-onnx") {
      // CPU model: need sherpa-onnx-node
      emitProgress(onProgress, "installing-deps", 5, "正在检查 sherpa-onnx-node...");
      const sherpaResult = await ensureSherpaOnnxNode(onProgress);
      if (!sherpaResult.ok) return { ok: false, error: sherpaResult.error };

      if (signal?.aborted) return { ok: false, error: "已取消" };
    }

    // Download model files
    emitProgress(onProgress, "downloading-models", 40, `正在下载 ${model.displayName}...`);
    const dlResult = await downloadModelsParallel([model], onProgress, signal);
    if (!dlResult.ok) {
      emitProgress(onProgress, "failed", 0, dlResult.error ?? "下载失败", {
        error: dlResult.error,
      });
      return { ok: false, error: dlResult.error };
    }

    emitProgress(onProgress, "complete", 100, `${model.displayName} 安装完成`);
    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message || String(err);
    emitProgress(onProgress, "failed", 0, `安装失败: ${msg}`, { error: msg });
    return { ok: false, error: msg };
  } finally {
    _installing = false;
  }
}

/**
 * Uninstall a single voice model by removing its files from disk.
 */
export function uninstallVoiceModel(modelId: string): { ok: boolean; error?: string } {
  const { ALL_MODELS } = require("./voice-models.js") as {
    ALL_MODELS: Record<string, VoiceModelSpec>;
  };
  const model = ALL_MODELS[modelId];
  if (!model) return { ok: false, error: `未知的语音模型: ${modelId}` };
  if (model.files.length === 0) return { ok: true }; // Edge TTS, nothing to remove

  const dir = path.join(VOICE_MODELS_DIR, model.modelDirName);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return { ok: true };
}
